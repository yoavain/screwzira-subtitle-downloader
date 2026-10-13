/**
 * Ktuvit sometimes answers a download with HTTP 200 and a short Hebrew error page instead of
 * the subtitle ("הבקשה לא נמצאה, נא לנסות להוריד את הקובץ בשנית"). The failure is transient.
 * A download identifier is single-use, so a failed one never recovers, but a fresh identifier usually succeeds.
 * A subtitle that does arrive is saved as UTF-8 with a BOM, whatever encoding Ktuvit served it in.
 * Fetch is mocked — no real network calls are made.
 */
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { randomUUID as uuid } from "node:crypto";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import { Classifier } from "~src/classifier";
import { handleSingleFile } from "~src/singleFileHandler";
import { NotificationType } from "~src/notifier";
import { MockConfig, MockLogger } from "~test/mocks";
import { TvShowIdCache } from "~src/parsers/ktuvit/tvShowIdCache";
import type { ConfigInterface } from "~src/config";
import { toWindows1255 } from "~test/sync/windows1255";

const VIDEO_FILENAME = "The Green Mile 1999 REPACK 1080p BluRay x265-YAWNTiC.mkv";
const MOVIE_ID = "A3F9B2A801BA0F3D69323A9C0950E236";
const SUBTITLE_ID = "0B43DF95185AD1C490EFFD1B9B491264";

const ERROR_PAGE: Buffer = fs.readFileSync(path.resolve(__dirname, "..", "..", "resources", "parsers", "ktuvit", "downloadRequestNotFound.txt"));
const SUBTITLE_CONTENT = "1\r\n00:00:30,000 --> 00:00:33,789\r\nשלום\r\n";

const SUBTITLE_HTML = [
    "<tr>",
    "<div style=\"float:left;\">",
    "The.Green.Mile.1999.1080p.BluRay.DTS.x264-VietHD<br />",
    `some text data-subtitle-id="${SUBTITLE_ID}" end`,
    "</div>",
    "</tr>"
].join("\n");

const SUBTITLE_AS_SAVED: Buffer = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(SUBTITLE_CONTENT, "utf-8")]);

type DownloadReply = "error" | "subtitle" | "windows1255Subtitle";

describe("KtuvitParser - download returns an error page", () => {
    let tmpDir: string;
    let videoPath: string;
    let notifMock: jest.Mock;
    let classifier: Classifier;
    let parser: KtuvitParser;
    let fetchSpy: jest.SpyInstance;
    let identifierRequests: number;
    let downloadedIdentifiers: string[];

    const mockKtuvit = (downloadReplies: DownloadReply[]) => {
        fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
            if (url.endsWith("/Login")) {
                return new Response("{\"d\":\"{\\\"IsSuccess\\\":true}\"}", { status: 200, headers: { "Set-Cookie": "Login=abc" } });
            }
            if (url.endsWith("/SearchPage_search")) {
                const { FilmName, Year } = JSON.parse(init.body as string).request;
                const films = FilmName.toLowerCase() === "the green mile" && Year === 1999 ?
                    [{ EngName: "The Green Mile", ID: MOVIE_ID, ReleaseDate: 1999, IsSeries: false }] :
                    [];
                return Response.json({ d: JSON.stringify({ Films: films }) });
            }
            if (url.includes(`/MovieInfo.aspx?ID=${MOVIE_ID}`)) {
                return new Response(SUBTITLE_HTML);
            }
            if (url.endsWith("/RequestSubtitleDownload")) {
                identifierRequests++;
                return Response.json({ d: JSON.stringify({ ValidIn: 0, DownloadIdentifier: `dl-${identifierRequests}`, IsSuccess: true, ErrorMessage: "" }) });
            }
            if (url.includes("/DownloadFile.ashx?DownloadIdentifier=")) {
                downloadedIdentifiers.push(new URL(url).searchParams.get("DownloadIdentifier"));
                const reply: DownloadReply = downloadReplies[downloadedIdentifiers.length - 1] ?? "error";
                if (reply === "error") {
                    return new Response(new Uint8Array(ERROR_PAGE));
                }
                const subtitle: Buffer = reply === "windows1255Subtitle" ? toWindows1255(SUBTITLE_CONTENT) : Buffer.from(SUBTITLE_CONTENT, "utf-8");
                return new Response(new Uint8Array(subtitle), { headers: { "Content-Disposition": "attachment; filename=The.Green.Mile.1999.1080p.BluRay.DTS.x264-VietHD.srt" } });
            }
            throw new Error(`Unexpected fetch: ${url}`);
        });
    };

    const subtitlePath = (): string => path.join(tmpDir, `${path.parse(VIDEO_FILENAME).name}.${classifier.getSubtitlesSuffix()}`);

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-download-error-"));
        videoPath = path.join(tmpDir, VIDEO_FILENAME);
        fs.writeFileSync(videoPath, "");

        notifMock = jest.fn();
        const logger = new MockLogger();
        // MockConfig blanks every title; the real Config keeps titles without a replace pair
        const config: ConfigInterface = { ...new MockConfig(), replaceTitleIfNeeded: (text: string): string => text };
        classifier = new Classifier(logger, config);
        const tvShowIdCache = new TvShowIdCache(uuid(), tmpDir);
        parser = new KtuvitParser("test@test.com", "password", logger, { notif: notifMock } as never, classifier, tvShowIdCache);
        (parser as any).downloadRetryDelaysMs = (parser as any).downloadRetryDelaysMs.map(() => 0);

        fetchSpy = jest.spyOn(global, "fetch");
        identifierRequests = 0;
        downloadedIdentifiers = [];
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("reports a failure and writes no subtitle file when every attempt returns the error page", async () => {
        mockKtuvit([]);

        const handled: boolean = await handleSingleFile(videoPath, true, classifier, { notif: notifMock } as never, parser);

        expect(handled).toBe(true);
        expect(fs.existsSync(subtitlePath())).toBe(false);
        expect(notifMock).toHaveBeenCalledWith(expect.stringContaining("Failed downloading subtitle"), NotificationType.FAILED);
        expect(notifMock).not.toHaveBeenCalledWith(expect.anything(), NotificationType.DOWNLOAD);
    });

    it("requests a fresh download identifier for each retry, up to 7 attempts", async () => {
        mockKtuvit([]);

        await handleSingleFile(videoPath, true, classifier, { notif: notifMock } as never, parser);

        expect(downloadedIdentifiers).toEqual(["dl-1", "dl-2", "dl-3", "dl-4", "dl-5", "dl-6", "dl-7"]);
    });

    it("writes the subtitle when a retry succeeds after the error page", async () => {
        mockKtuvit(["error", "error", "subtitle"]);

        await handleSingleFile(videoPath, true, classifier, { notif: notifMock } as never, parser);

        expect(downloadedIdentifiers).toEqual(["dl-1", "dl-2", "dl-3"]);
        expect(fs.readFileSync(subtitlePath())).toEqual(SUBTITLE_AS_SAVED);
        expect(notifMock).toHaveBeenCalledWith(expect.stringContaining("Successfully downloaded"), NotificationType.DOWNLOAD);
        expect(notifMock).not.toHaveBeenCalledWith(expect.anything(), NotificationType.FAILED);
    });

    it("saves a Windows-1255 subtitle as UTF-8 with a BOM", async () => {
        mockKtuvit(["windows1255Subtitle"]);

        await handleSingleFile(videoPath, true, classifier, { notif: notifMock } as never, parser);

        expect(fs.readFileSync(subtitlePath())).toEqual(SUBTITLE_AS_SAVED);
    });
});
