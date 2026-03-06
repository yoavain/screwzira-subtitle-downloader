import * as path from "path";
import { EnglishSourceFinder } from "~src/sync/englishSourceFinder";
import type { MkvExtractorInterface } from "~src/sync/mkvExtractor";
import { MockLogger } from "~test/__mocks__";

jest.mock("~src/fileUtils");

import { isExist } from "~src/fileUtils";
const mockIsExist = isExist as jest.Mock;

const FAKE_VIDEO_MKV = path.join("fake", "dir", "video.mkv");
const FAKE_VIDEO_AVI = path.join("fake", "dir", "video.avi");
const FAKE_ENG_SRT = path.join("fake", "dir", "video.eng.srt");
const FAKE_MKV_MERGE = path.join("fake", "bin", "mkvmerge.exe");

function makeMockMkvExtractor(overrides: Partial<MkvExtractorInterface> = {}): MkvExtractorInterface {
    return {
        findEnglishSubtitleTrack: jest.fn().mockResolvedValue({ trackId: 1, codec: "S_TEXT/UTF8" }),
        extractSubtitle: jest.fn().mockResolvedValue(undefined),
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
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBe(FAKE_ENG_SRT);
        expect(mkvExtractor.findEnglishSubtitleTrack).not.toHaveBeenCalled();
    });

    it("returns null for non-.mkv extension", async () => {
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_AVI);

        expect(result).toBeNull();
        expect(mkvExtractor.findEnglishSubtitleTrack).not.toHaveBeenCalled();
    });

    it("returns null when mkvmerge.exe does not exist", async () => {
        mockIsExist.mockResolvedValueOnce(false); // no eng.srt
        mockIsExist.mockResolvedValueOnce(false); // mkvmerge not found
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
        expect(mkvExtractor.findEnglishSubtitleTrack).not.toHaveBeenCalled();
    });

    it("returns null when findEnglishSubtitleTrack throws", async () => {
        mockIsExist.mockResolvedValueOnce(false); // no eng.srt
        mockIsExist.mockResolvedValueOnce(true);  // mkvmerge found
        const mkvExtractor = makeMockMkvExtractor({
            findEnglishSubtitleTrack: jest.fn().mockRejectedValue(new Error("mkvmerge crashed"))
        });
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
    });

    it("returns null when no English track found in MKV", async () => {
        mockIsExist.mockResolvedValueOnce(false); // no eng.srt
        mockIsExist.mockResolvedValueOnce(true);  // mkvmerge found
        const mkvExtractor = makeMockMkvExtractor({
            findEnglishSubtitleTrack: jest.fn().mockResolvedValue(null)
        });
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
        expect(mkvExtractor.extractSubtitle).not.toHaveBeenCalled();
    });

    it("returns null when extractSubtitle throws", async () => {
        mockIsExist.mockResolvedValueOnce(false); // no eng.srt
        mockIsExist.mockResolvedValueOnce(true);  // mkvmerge found
        const mkvExtractor = makeMockMkvExtractor({
            extractSubtitle: jest.fn().mockRejectedValue(new Error("mkvextract crashed"))
        });
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBeNull();
    });

    it("returns extracted .eng.srt path on full success", async () => {
        mockIsExist.mockResolvedValueOnce(false); // no eng.srt yet
        mockIsExist.mockResolvedValueOnce(true);  // mkvmerge found
        const mkvExtractor = makeMockMkvExtractor();
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);

        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);

        expect(result).toBe(FAKE_ENG_SRT);
        expect(mkvExtractor.findEnglishSubtitleTrack).toHaveBeenCalledWith(FAKE_VIDEO_MKV);
        expect(mkvExtractor.extractSubtitle).toHaveBeenCalledWith(FAKE_VIDEO_MKV, 1, FAKE_ENG_SRT);
    });

    it("returns null when findEnglishSubtitleTrack throws a non-Error value", async () => {
        mockIsExist.mockResolvedValueOnce(false);
        mockIsExist.mockResolvedValueOnce(true);
        const mkvExtractor = makeMockMkvExtractor({
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            findEnglishSubtitleTrack: jest.fn().mockRejectedValue("string error (non-Error)")
        });
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);
        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);
        expect(result).toBeNull();
    });

    it("returns null when extractSubtitle throws a non-Error value", async () => {
        mockIsExist.mockResolvedValueOnce(false);
        mockIsExist.mockResolvedValueOnce(true);
        const mkvExtractor = makeMockMkvExtractor({
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            extractSubtitle: jest.fn().mockRejectedValue("extraction error string")
        });
        const finder = new EnglishSourceFinder(mkvExtractor, FAKE_MKV_MERGE, logger);
        const result = await finder.findEnglishSrt(FAKE_VIDEO_MKV);
        expect(result).toBeNull();
    });
});
