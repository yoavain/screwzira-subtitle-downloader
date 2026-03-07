import * as path from "node:path";
import { EnglishSourceFinder } from "~src/sync/englishSourceFinder";
import type { MkvExtractorInterface } from "~src/sync/mkvExtractor";
import { MockLogger } from "~test/mocks";

jest.mock("~src/fileUtils");

import { isExist } from "~src/fileUtils";
const mockIsExist = isExist as jest.Mock;

const FAKE_VIDEO_MKV = path.join("fake", "dir", "video.mkv");
const FAKE_VIDEO_AVI = path.join("fake", "dir", "video.avi");
const FAKE_ENG_SRT = path.join("fake", "dir", "video.eng.srt");

function makeMockMkvExtractor(overrides: Partial<MkvExtractorInterface> = {}): MkvExtractorInterface {
    return {
        findEnglishSubtitleTrack: jest.fn().mockResolvedValue({ trackId: 1, codec: "S_TEXT/UTF8" }),
        extractSubtitle: jest.fn().mockResolvedValue(undefined),
        hasHebrewSubtitleTrack: jest.fn().mockResolvedValue(false),
        hasEnglishSubtitleTrack: jest.fn().mockResolvedValue(true),
        ...overrides
    };
}

describe("EnglishSourceFinder unit tests", () => {
    const logger = new MockLogger();

    beforeEach(() => {
        mockIsExist.mockResolvedValue(false);
    });

    it("returns existing .eng.srt path when file is already on disk", async () => {
        mockIsExist.mockResolvedValue(true); // eng.srt exists
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBe(FAKE_ENG_SRT);
        expect(mkvExtractor.findEnglishSubtitleTrack).not.toHaveBeenCalled();
    });

    it("returns null for non-.mkv extension", async () => {
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_AVI);

        expect(result).toBeNull();
        expect(mkvExtractor.findEnglishSubtitleTrack).not.toHaveBeenCalled();
    });

    it("returns null when findEnglishSubtitleTrack throws", async () => {
        const mkvExtractor = makeMockMkvExtractor({
            findEnglishSubtitleTrack: jest.fn().mockRejectedValue(new Error("mkvmerge crashed"))
        });
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
    });

    it("returns null when no English track found in MKV", async () => {
        const mkvExtractor = makeMockMkvExtractor({
            findEnglishSubtitleTrack: jest.fn().mockResolvedValue(null)
        });
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
        expect(mkvExtractor.extractSubtitle).not.toHaveBeenCalled();
    });

    it("returns null when extractSubtitle throws", async () => {
        const mkvExtractor = makeMockMkvExtractor({
            extractSubtitle: jest.fn().mockRejectedValue(new Error("mkvextract crashed"))
        });
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
    });

    it("returns extracted .eng.srt path on full success", async () => {
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBe(FAKE_ENG_SRT);
        expect(mkvExtractor.findEnglishSubtitleTrack).toHaveBeenCalledWith(FAKE_VIDEO_MKV);
        expect(mkvExtractor.extractSubtitle).toHaveBeenCalledWith(FAKE_VIDEO_MKV, 1, FAKE_ENG_SRT);
    });

    it("returns null when findEnglishSubtitleTrack throws a non-Error value", async () => {
        const mkvExtractor = makeMockMkvExtractor({
            findEnglishSubtitleTrack: jest.fn().mockRejectedValue("string error (non-Error)")
        });
        const finder = new EnglishSourceFinder(mkvExtractor, logger);
        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);
        expect(result).toBeNull();
    });

    it("returns null when extractSubtitle throws a non-Error value", async () => {
        const mkvExtractor = makeMockMkvExtractor({
            extractSubtitle: jest.fn().mockRejectedValue("extraction error string")
        });
        const finder = new EnglishSourceFinder(mkvExtractor, logger);
        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);
        expect(result).toBeNull();
    });
});
