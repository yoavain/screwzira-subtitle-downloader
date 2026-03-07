import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import type * as ChildProcess from "node:child_process";
import type * as Util from "node:util";
import { MkvExtractor } from "~src/sync/mkvExtractor";
import { parseSrt } from "~src/sync/subtitleParser";
import { MockLogger } from "~test/mocks";

// Mock child_process so that promisify picks up the custom async implementation.
// _asyncFn is the function that execAsync resolves to (via util.promisify.custom).
jest.mock("child_process", () => {
    const util = jest.requireActual<typeof Util>("util");
    const asyncFn = jest.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const execFn = jest.fn();
    Object.defineProperty(execFn, util.promisify.custom, { value: asyncFn, writable: true });
    return { exec: execFn, _asyncFn: asyncFn };
});

type ChildProcessMock = { exec: jest.Mock; _asyncFn: jest.Mock };
const { _asyncFn } = jest.requireMock<ChildProcessMock>("child_process");

function makeMkvJson(tracks: object[]): string {
    return JSON.stringify({ tracks });
}

function makeTrack(overrides: {
    id?: number;
    type?: string;
    codec?: string;
    language?: string;
    language_ietf?: string;
}): object {
    const { id = 0, type = "subtitles", codec = "S_TEXT/UTF8", language, language_ietf } = overrides;
    return {
        id,
        type,
        codec,
        properties: {
            ...(language !== undefined ? { language } : {}),
            ...(language_ietf !== undefined ? { language_ietf } : {})
        }
    };
}

// --- Unit tests ---

describe("MkvExtractor unit tests", () => {
    let extractor: MkvExtractor;
    const logger = new MockLogger();

    beforeEach(() => {
        extractor = new MkvExtractor("/fake/mkvtoolnix", logger);
        _asyncFn.mockResolvedValue({ stdout: "", stderr: "" });
    });

    describe("findEnglishSubtitleTrack", () => {
        it("returns { trackId, codec } for a language=eng text track", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 2, codec: "S_TEXT/UTF8", language: "eng" })]),
                stderr: ""
            });
            const result = await extractor.findEnglishSubtitleTrack("/path/to/video.mkv");
            expect(result).toEqual({ trackId: 2, codec: "S_TEXT/UTF8" });
        });

        it("returns null when no English subtitle track found", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, type: "audio", codec: "A_AAC", language: "eng" })]),
                stderr: ""
            });
            const result = await extractor.findEnglishSubtitleTrack("/path/to/video.mkv");
            expect(result).toBeNull();
        });

        it("handles language_ietf starting with 'en' (e.g. en-US)", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 3, codec: "S_TEXT/ASS", language_ietf: "en-US" })]),
                stderr: ""
            });
            const result = await extractor.findEnglishSubtitleTrack("/path/to/video.mkv");
            expect(result).toEqual({ trackId: 3, codec: "S_TEXT/ASS" });
        });

        it("skips PGS/bitmap track and returns the text track", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([
                    makeTrack({ id: 1, codec: "S_HDMV/PGS", language: "eng" }),
                    makeTrack({ id: 2, codec: "S_TEXT/UTF8", language: "eng" })
                ]),
                stderr: ""
            });
            const result = await extractor.findEnglishSubtitleTrack("/path/to/video.mkv");
            expect(result).toEqual({ trackId: 2, codec: "S_TEXT/UTF8" });
        });

        it("returns null when only a PGS (bitmap) track exists", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, codec: "S_HDMV/PGS", language: "eng" })]),
                stderr: ""
            });
            const result = await extractor.findEnglishSubtitleTrack("/path/to/video.mkv");
            expect(result).toBeNull();
        });
    });

    describe("hasHebrewSubtitleTrack", () => {
        it("returns true for language=heb text track", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, codec: "S_TEXT/UTF8", language: "heb" })]),
                stderr: ""
            });
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(true);
        });

        it("returns true for language_ietf=he-IL text track", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, codec: "S_TEXT/UTF8", language_ietf: "he-IL" })]),
                stderr: ""
            });
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(true);
        });

        it("returns false when no Hebrew subtitle track exists", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, codec: "S_TEXT/UTF8", language: "eng" })]),
                stderr: ""
            });
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(false);
        });

        it("returns false for Hebrew PGS (image) track", async () => {
            _asyncFn.mockResolvedValue({
                stdout: makeMkvJson([makeTrack({ id: 1, codec: "S_HDMV/PGS", language: "heb" })]),
                stderr: ""
            });
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(false);
        });

        it("returns false when mkvmerge fails", async () => {
            _asyncFn.mockRejectedValue(new Error("process exited with code 1"));
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(false);
        });

        it("returns false when stdout is not valid JSON", async () => {
            _asyncFn.mockResolvedValue({ stdout: "not json", stderr: "" });
            const result = await extractor.hasHebrewSubtitleTrack("/path/to/video.mkv");
            expect(result).toBe(false);
        });
    });

    describe("extractSubtitle", () => {
        it("calls mkvextract with the track id and output path in the command", async () => {
            _asyncFn.mockResolvedValue({ stdout: "", stderr: "" });
            await extractor.extractSubtitle("/path/to/video.mkv", 2, "/path/to/out.srt");
            expect(_asyncFn).toHaveBeenCalledTimes(1);
            const cmd: string = _asyncFn.mock.calls[0][0] as string;
            expect(cmd).toContain("mkvextract.exe");
            expect(cmd).toContain("2:");
            expect(cmd).toContain("out.srt");
        });
    });
});

// --- Integration tests (require dist/mkvtoolnix/ binaries and sample.mkv) ---

const SAMPLE_MKV = path.resolve(__dirname, "../resources/sync/mkvtoolnix/sample.mkv");
const MKV_TOOLNIX_DIR = path.resolve(__dirname, "../../dist/mkvtoolnix");
const MKV_MERGE_PATH = path.join(MKV_TOOLNIX_DIR, "mkvmerge.exe");
const MKV_EXTRACT_PATH = path.join(MKV_TOOLNIX_DIR, "mkvextract.exe");

const binariesExist =
    fs.existsSync(MKV_MERGE_PATH) && fs.existsSync(MKV_EXTRACT_PATH) && fs.existsSync(SAMPLE_MKV);

const describeIntegration = binariesExist ? describe : describe.skip;

describeIntegration("MkvExtractor integration tests (real binaries + sample.mkv)", () => {
    let extractor: MkvExtractor;
    const logger = new MockLogger();

    const realChildProcess = jest.requireActual<typeof ChildProcess>("child_process");
    const { promisify: realPromisify } = jest.requireActual<typeof Util>("util");
    const realExecAsync = realPromisify(realChildProcess.exec);

    beforeAll(() => {
        extractor = new MkvExtractor(MKV_TOOLNIX_DIR, logger);
        _asyncFn.mockImplementation((cmd: string) => realExecAsync(cmd));
    });

    it("findEnglishSubtitleTrack returns non-null for sample.mkv", async () => {
        const result = await extractor.findEnglishSubtitleTrack(SAMPLE_MKV);
        expect(result).not.toBeNull();
        expect(result!.trackId).toBeGreaterThanOrEqual(0);
        expect(result!.codec.length).toBeGreaterThan(0);
    }, 30000);

    it("extractSubtitle writes a file on disk", async () => {
        const track = await extractor.findEnglishSubtitleTrack(SAMPLE_MKV);
        expect(track).not.toBeNull();
        const outPath = path.join(os.tmpdir(), `ktuvit-test-extract-${Date.now()}.srt`);
        try {
            await extractor.extractSubtitle(SAMPLE_MKV, track!.trackId, outPath);
            expect(fs.existsSync(outPath)).toBe(true);
        }
        finally {
            fs.rmSync(outPath, { force: true });
        }
    }, 30000);

    it("extracted SRT parses to at least 1 SubtitleEntry", async () => {
        const track = await extractor.findEnglishSubtitleTrack(SAMPLE_MKV);
        expect(track).not.toBeNull();
        const outPath = path.join(os.tmpdir(), `ktuvit-test-parse-${Date.now()}.srt`);
        try {
            await extractor.extractSubtitle(SAMPLE_MKV, track!.trackId, outPath);
            const content = fs.readFileSync(outPath, "utf-8");
            const entries = parseSrt(content);
            expect(entries.length).toBeGreaterThanOrEqual(1);
        }
        finally {
            fs.rmSync(outPath, { force: true });
        }
    }, 30000);
});
