/**
 * Unit tests for KtuvitParser error-handling paths.
 * Fetch is mocked — no real network calls are made.
 */
import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { randomUUID as uuid } from "node:crypto";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import { Classifier, FileClassification } from "~src/classifier";
import type { MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { NotificationType } from "~src/notifier";
import { MockLogger, MockConfig } from "~test/mocks";
import { TvShowIdCache } from "~src/parsers/ktuvit/tvShowIdCache";

// HTML that parseSubtitles can extract one subtitle from
const SUBTITLE_HTML = [
    "<tr>",
    "<div style=\"float:left;\">",
    "Frozen 2013 720p BluRay x264<br />",
    "some text data-subtitle-id=\"sub001\" end",
    "</div>",
    "</tr>"
].join("\n");

function makeResponse(status: number, extra: Partial<Response> = {}): Response {
    return {
        status,
        statusText: status === 200 ? "OK" : "Server Error",
        text: jest.fn().mockResolvedValue(""),
        headers: { getSetCookie: jest.fn().mockReturnValue([]) },
        ...extra
    } as unknown as Response;
}

function makeCookieResponse(): Response {
    return makeResponse(200, {
        headers: { getSetCookie: jest.fn().mockReturnValue(["session=abc123"]) }
    } as unknown as Partial<Response>);
}

function makeSearchResponse(films: object[]): Response {
    return makeResponse(200, {
        json: jest.fn().mockResolvedValue({ d: JSON.stringify({ Films: films }) })
    } as unknown as Partial<Response>);
}

const FROZEN_FILM = {
    EngName: "Frozen",
    ID: "film123",
    ReleaseDate: 2013,
    IsSeries: false,
    HebName: "פרוזן",
    ImdbID: "tt2294629"
};

const SIMPSONS_SERIES = {
    EngName: "The Simpsons",
    ID: "series123",
    IsSeries: true,
    HebName: "הסימפסונים",
    ImdbID: "tt0096697",
    ReleaseDate: 1989
};

const MOVIE: MovieFileClassificationInterface = {
    type: FileClassification.MOVIE,
    movieName: "Frozen",
    movieYear: 2013,
    filenameNoExtension: "Frozen.2013.1080p.BluRay.x264",
    relativePath: "."
};

const MOVIE_SEQUEL: MovieFileClassificationInterface = {
    type: FileClassification.MOVIE,
    movieName: "Frozen 2",
    movieYear: 2019,
    filenameNoExtension: "Frozen.2.2019.BluRay",
    relativePath: "."
};

const EPISODE: TvEpisodeFileClassificationInterface = {
    type: FileClassification.EPISODE,
    series: "The Simpsons",
    season: 1,
    episode: 1,
    filenameNoExtension: "The Simpsons S01E01",
    relativePath: "."
};

describe("KtuvitParser private method error paths (fetchWithRetry spy)", () => {
    let fwrSpy: jest.SpyInstance;
    let notifMock: jest.Mock;
    let parser: KtuvitParser;
    let tmpDir: string;

    beforeEach(() => {
        notifMock = jest.fn();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-unit-fwr-"));
        const logger = new MockLogger();
        const config = new MockConfig();
        const classifier = new Classifier(logger, config);
        const tvShowIdCache = new TvShowIdCache(uuid(), tmpDir);
        const mockNotifier = { notif: notifMock };
        parser = new KtuvitParser(
            "test@test.com", "password",
            logger, mockNotifier as never, classifier, tvShowIdCache
        );
        fwrSpy = jest.spyOn(parser as any, "fetchWithRetry");
    });

    afterEach(() => {
        fwrSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("login: catch branch triggers FAILED when fetchWithRetry throws", async () => {
        fwrSpy.mockRejectedValueOnce(new Error("connection refused"));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Failed to login"),
            NotificationType.FAILED,
            true
        );
    });

    it("findId: else branch notifies FAILED when search returns non-200", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeResponse(500, { text: jest.fn().mockResolvedValue("") }));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find movie ID"),
            NotificationType.FAILED,
            true
        );
    });

    it("findId: catch branch notifies FAILED when search throws", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockRejectedValueOnce(new Error("search network error"));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find movie ID"),
            NotificationType.FAILED,
            true
        );
    });

    it("getSubtitles: else branch notifies FAILED when subtitle page returns non-200", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(500, { text: jest.fn().mockResolvedValue("") }));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitles"),
            NotificationType.FAILED,
            true
        );
    });

    it("getSubtitles: catch branch notifies FAILED when subtitle page throws", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockRejectedValueOnce(new Error("subtitle page timeout"));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitles"),
            NotificationType.FAILED,
            true
        );
    });

    it("getDownloadIdentifier: else branch notifies FAILED when request returns non-200", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(200, { text: jest.fn().mockResolvedValue(SUBTITLE_HTML) }))
            .mockResolvedValueOnce(makeResponse(500));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitle download identifier"),
            NotificationType.FAILED
        );
    });

    it("getDownloadIdentifier: catch branch notifies FAILED when request throws", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(200, { text: jest.fn().mockResolvedValue(SUBTITLE_HTML) }))
            .mockRejectedValueOnce(new Error("download ID error"));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitle download identifier"),
            NotificationType.FAILED
        );
    });

    it("downloadFile: else branch notifies FAILED when download returns non-200", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(200, { text: jest.fn().mockResolvedValue(SUBTITLE_HTML) }))
            .mockResolvedValueOnce(makeResponse(200, { json: jest.fn().mockResolvedValue({ d: JSON.stringify({ DownloadIdentifier: "dlid123" }) }) }))
            .mockResolvedValueOnce(makeResponse(500));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Failed downloading subtitle"),
            NotificationType.FAILED
        );
    });

    it("downloadFile: catch branch notifies FAILED when download throws", async () => {
        fwrSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(200, { text: jest.fn().mockResolvedValue(SUBTITLE_HTML) }))
            .mockResolvedValueOnce(makeResponse(200, { json: jest.fn().mockResolvedValue({ d: JSON.stringify({ DownloadIdentifier: "dlid123" }) }) }))
            .mockRejectedValueOnce(new Error("download threw"));
        await parser.handleMovie(MOVIE);
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Failed downloading subtitle"),
            NotificationType.FAILED
        );
    });
});

describe("KtuvitParser error-handling (mocked fetch)", () => {
    let fetchSpy: jest.SpyInstance;
    let parser: KtuvitParser;
    let notifMock: jest.Mock;
    let tmpDir: string;

    beforeEach(() => {
        fetchSpy = jest.spyOn(global, "fetch");
        notifMock = jest.fn();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-unit-"));

        const logger = new MockLogger();
        const config = new MockConfig();
        const classifier = new Classifier(logger, config);
        const tvShowIdCache = new TvShowIdCache(uuid(), tmpDir);
        const mockNotifier = { notif: notifMock };

        parser = new KtuvitParser(
            "test@test.com", "password",
            logger, mockNotifier as never, classifier, tvShowIdCache
        );
    });

    afterEach(() => {
        fetchSpy.mockRestore();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- handleMovie ---

    it("handleMovie: notifies FAILED when login returns non-200", async () => {
        fetchSpy.mockResolvedValue(makeResponse(500, {
            text: jest.fn().mockResolvedValue("Server error")
        } as unknown as Partial<Response>));

        await parser.handleMovie(MOVIE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Failed to login"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleMovie: notifies FAILED when movie ID not found (no alternative name)", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse()) // login
            .mockResolvedValueOnce(makeSearchResponse([])); // search → no results

        await parser.handleMovie(MOVIE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find movie ID"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleMovie: tries alternative name when movie has sequel number, notifies FAILED if both fail", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse()) // login
            .mockResolvedValueOnce(makeSearchResponse([])) // first search "Frozen 2" → empty
            .mockResolvedValueOnce(makeSearchResponse([])); // alternative "Frozen II" → empty

        await parser.handleMovie(MOVIE_SEQUEL);

        // Both searches failed → "Unable to find movie ID"
        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find movie ID"),
            NotificationType.FAILED,
            true
        );
        // fetch was called 3 times (login + 2 searches)
        expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it("handleMovie: notifies FAILED when no subtitles found", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse()) // login
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM])) // search → found
            .mockResolvedValueOnce(makeResponse(200, { // movie subtitle page → empty
                text: jest.fn().mockResolvedValue("<html>no subs</html>")
            } as unknown as Partial<Response>));

        await parser.handleMovie(MOVIE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitles"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleMovie: notifies FAILED when download identifier is empty", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([FROZEN_FILM]))
            .mockResolvedValueOnce(makeResponse(200, {
                text: jest.fn().mockResolvedValue(SUBTITLE_HTML)
            } as unknown as Partial<Response>))
            .mockResolvedValueOnce(makeResponse(200, { // getDownloadIdentifier → no identifier
                json: jest.fn().mockResolvedValue({ d: "{}" })
            } as unknown as Partial<Response>));

        await parser.handleMovie(MOVIE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitle download identifier"),
            NotificationType.FAILED
        );
    });

    // --- handleEpisode ---

    it("handleEpisode: notifies FAILED when login returns non-200", async () => {
        fetchSpy.mockResolvedValue(makeResponse(500, {
            text: jest.fn().mockResolvedValue("Error")
        } as unknown as Partial<Response>));

        await parser.handleEpisode(EPISODE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Failed to login"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleEpisode: notifies FAILED when series ID not found", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse()) // login
            .mockResolvedValueOnce(makeSearchResponse([])); // series search → empty

        await parser.handleEpisode(EPISODE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find series ID"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleEpisode: notifies FAILED when no subtitles found", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([SIMPSONS_SERIES]))
            .mockResolvedValueOnce(makeResponse(200, {
                text: jest.fn().mockResolvedValue("<html>no subs</html>")
            } as unknown as Partial<Response>));

        await parser.handleEpisode(EPISODE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitles"),
            NotificationType.FAILED,
            true
        );
    });

    it("handleEpisode: notifies FAILED when download identifier is empty", async () => {
        fetchSpy
            .mockResolvedValueOnce(makeCookieResponse())
            .mockResolvedValueOnce(makeSearchResponse([SIMPSONS_SERIES]))
            .mockResolvedValueOnce(makeResponse(200, {
                text: jest.fn().mockResolvedValue(SUBTITLE_HTML)
            } as unknown as Partial<Response>))
            .mockResolvedValueOnce(makeResponse(200, {
                json: jest.fn().mockResolvedValue({ d: "{}" })
            } as unknown as Partial<Response>));

        await parser.handleEpisode(EPISODE);

        expect(notifMock).toHaveBeenCalledWith(
            expect.stringContaining("Unable to find subtitle download identifier"),
            NotificationType.FAILED
        );
    });
});
