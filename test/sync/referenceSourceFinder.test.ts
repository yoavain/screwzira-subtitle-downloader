import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { ReferenceSourceFinder, deriveStem } from "~src/sync/referenceSourceFinder";
import type { MkvExtractorInterface, SubtitleTrack } from "~src/sync/mkvExtractor";
import { MockLogger } from "~test/mocks";

const logger = new MockLogger();
const TAGS = ["he", "heb", "iw", "hebrew", "forced", "sdh", "hi", "cc"];

function makeExtractor(track: SubtitleTrack | null, onExtract?: (out: string) => void): MkvExtractorInterface {
    return {
        findSubtitleTrack: jest.fn().mockResolvedValue(track),
        hasSubtitleTrack: jest.fn().mockResolvedValue(track !== null),
        extractSubtitle: jest.fn().mockImplementation(async (_mkv: string, _id: number, out: string) => {
            fs.writeFileSync(out, "1\n00:00:01,000 --> 00:00:02,000\nref\n");
            onExtract?.(out);
        })
    };
}

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "refsrc-"));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function touch(relativePath: string): string {
    const full = path.join(tmpDir, relativePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "1\n00:00:01,000 --> 00:00:02,000\nx\n");
    return full;
}

function finder(extractor: MkvExtractorInterface, languages = ["fr", "en"]): ReferenceSourceFinder {
    return new ReferenceSourceFinder(languages, ["hebrew"], extractor, logger);
}

describe("deriveStem", () => {
    it.each([
        ["Movie.Hebrew", "Movie"],
        ["Movie.heb", "Movie"],
        ["Movie.HE", "Movie"],
        ["Movie.forced", "Movie"],
        ["The.Office.S01E01.720p-CtrlHD.heb", "The.Office.S01E01.720p-CtrlHD"],
        // Segments that are part of the title must survive.
        ["Movie.2021.1080p", "Movie.2021.1080p"],
        ["Movie", "Movie"],
        [".hidden", ".hidden"]
    ])("%s -> %s", (input, expected) => {
        expect(deriveStem(input, [...TAGS, "hebrew"])).toBe(expected);
    });

    it("strips only one segment", () => {
        expect(deriveStem("Movie.heb.forced", TAGS)).toBe("Movie.heb");
    });
});

describe("ReferenceSourceFinder — sidecars", () => {
    it("finds an English sidecar", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.en.srt");

        const result = await finder(makeExtractor(null)).find(target);

        expect(result?.language).toBe("en");
        expect(result?.origin).toBe("sidecar");
    });

    it("prefers French over English", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.en.srt");
        touch("Movie.fr.srt");

        expect((await finder(makeExtractor(null)).find(target))?.language).toBe("fr");
    });

    it.each(["fr", "fra", "fre", "french"])("accepts the .%s spelling", async (suffix) => {
        const target = touch("Movie.Hebrew.srt");
        touch(`Movie.${suffix}.srt`);

        expect((await finder(makeExtractor(null)).find(target))?.language).toBe("fr");
    });

    it("returns null when no reference exists", async () => {
        const target = touch("Movie.Hebrew.srt");
        expect(await finder(makeExtractor(null)).find(target)).toBeNull();
    });

    it("never returns the clicked file as its own reference", async () => {
        // Right-clicking the French subtitle must not resolve to itself.
        const target = touch("Movie.fr.srt");

        expect(await finder(makeExtractor(null)).find(target)).toBeNull();
    });

    it("works with no video file present", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.fr.srt");

        const result = await finder(makeExtractor(null)).find(target);

        expect(result?.origin).toBe("sidecar");
    });

    it("searches the parent folder for a Subs/ layout", async () => {
        const target = touch("Subs/Movie.Hebrew.srt");
        touch("Movie.fr.srt");

        const result = await finder(makeExtractor(null)).find(target);

        expect(result?.language).toBe("fr");
    });

    it("honours a custom language priority", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.en.srt");
        touch("Movie.fr.srt");

        expect((await finder(makeExtractor(null), ["en", "fr"]).find(target))?.language).toBe("en");
    });
});

describe("ReferenceSourceFinder — embedded tracks", () => {
    it("prefers an embedded track over a sidecar", async () => {
        // An embedded track is guaranteed to match this video; a sidecar may be for another release.
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.mkv");
        touch("Movie.en.srt");
        const extractor = makeExtractor({ trackId: 2, codec: "S_TEXT/UTF8", language: "fr" });

        const result = await finder(extractor).find(target);

        expect(result?.origin).toBe("embedded");
        expect(result?.language).toBe("fr");
        expect(extractor.extractSubtitle).toHaveBeenCalled();
    });

    it("falls back to a sidecar when the MKV has no usable track", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.mkv");
        touch("Movie.en.srt");

        const result = await finder(makeExtractor(null)).find(target);

        expect(result?.origin).toBe("sidecar");
    });

    it("falls back to a sidecar when mkvmerge throws", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.mkv");
        touch("Movie.fr.srt");
        const extractor: MkvExtractorInterface = {
            findSubtitleTrack: jest.fn().mockRejectedValue(new Error("mkvmerge missing")),
            hasSubtitleTrack: jest.fn().mockResolvedValue(false),
            extractSubtitle: jest.fn()
        };

        const result = await finder(extractor).find(target);

        expect(result?.origin).toBe("sidecar");
    });

    it("reuses a previously extracted reference instead of extracting again", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.mkv");
        touch("Movie.fr.srt");
        const extractor = makeExtractor({ trackId: 2, codec: "S_TEXT/UTF8", language: "fr" });

        const result = await finder(extractor).find(target);

        expect(result?.origin).toBe("embedded");
        expect(extractor.extractSubtitle).not.toHaveBeenCalled();
    });

    it("uses the only video in the folder when nothing matches the stem", async () => {
        const target = touch("Some.Other.Name.Hebrew.srt");
        touch("Movie.mkv");
        const extractor = makeExtractor({ trackId: 1, codec: "S_TEXT/UTF8", language: "en" });

        const result = await finder(extractor).find(target);

        expect(result?.origin).toBe("embedded");
        expect(result?.language).toBe("en");
    });

    it("does not guess when the folder holds several videos", async () => {
        const target = touch("Some.Other.Name.Hebrew.srt");
        touch("MovieA.mkv");
        touch("MovieB.mkv");
        const extractor = makeExtractor({ trackId: 1, codec: "S_TEXT/UTF8", language: "en" });

        expect(await finder(extractor).find(target)).toBeNull();
        expect(extractor.findSubtitleTrack).not.toHaveBeenCalled();
    });

    it("ignores a non-MKV video for embedded lookup", async () => {
        const target = touch("Movie.Hebrew.srt");
        touch("Movie.mp4");
        const extractor = makeExtractor({ trackId: 1, codec: "S_TEXT/UTF8", language: "en" });

        expect(await finder(extractor).find(target)).toBeNull();
        expect(extractor.findSubtitleTrack).not.toHaveBeenCalled();
    });
});
