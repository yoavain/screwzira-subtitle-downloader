import { applyTimingCorrections } from "~src/sync/timingCorrector";
import type { SubtitleEntry, MatchEntry, SceneChunk } from "~src/sync/types";
import { MockLogger } from "~test/__mocks__";

function makeEntry(i: number, start: number, end: number, text = "text"): SubtitleEntry {
    return { index: i + 1, start, end, text };
}

describe("applyTimingCorrections", () => {
    const logger = new MockLogger();

    it("applies 1:1 chunk offset", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 2000)];
        const eng: SubtitleEntry[] = [makeEntry(0, 1500, 2500)];
        const matches: MatchEntry[] = [{ hebrewIndices: [0], englishIndices: [0], offset: 500 }];
        const chunks: SceneChunk[] = [{ hebrewStartIdx: 0, hebrewEndIdx: 0, medianOffset: 600 }];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        expect(result[0].start).toBe(1600);
        expect(result[0].end).toBe(2600);
    });

    it("falls back to match offset when no chunk covers the index", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 2000)];
        const eng: SubtitleEntry[] = [makeEntry(0, 1500, 2500)];
        const matches: MatchEntry[] = [{ hebrewIndices: [0], englishIndices: [0], offset: 500 }];
        const chunks: SceneChunk[] = [];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        expect(result[0].start).toBe(1500);
        expect(result[0].end).toBe(2500);
    });

    it("handles 1:2 split by spanning both English lines", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 2000)];
        const eng: SubtitleEntry[] = [makeEntry(0, 1100, 1500), makeEntry(1, 1600, 2100)];
        const matches: MatchEntry[] = [{ hebrewIndices: [0], englishIndices: [0, 1], offset: 100 }];
        const chunks: SceneChunk[] = [];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        expect(result[0].start).toBe(1100);
        expect(result[0].end).toBe(2100);
    });

    it("handles 2:1 merge by splitting English line at midpoint", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 1500), makeEntry(1, 1600, 2000)];
        const eng: SubtitleEntry[] = [makeEntry(0, 1000, 2000)];
        const matches: MatchEntry[] = [{ hebrewIndices: [0, 1], englishIndices: [0], offset: 0 }];
        const chunks: SceneChunk[] = [];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        const engMidpoint = Math.floor((1000 + 2000) / 2);
        expect(result[0].start).toBe(1000);
        expect(result[0].end).toBe(engMidpoint);
        expect(result[1].start).toBe(engMidpoint);
        expect(result[1].end).toBe(2000);
    });

    it("keeps original timing for unmatched lines", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 2000)];
        const eng: SubtitleEntry[] = [];
        const matches: MatchEntry[] = [];
        const chunks: SceneChunk[] = [];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        expect(result[0].start).toBe(1000);
        expect(result[0].end).toBe(2000);
    });

    it("preserves original text content", () => {
        const heb: SubtitleEntry[] = [makeEntry(0, 1000, 2000, "שלום עולם")];
        const eng: SubtitleEntry[] = [makeEntry(0, 1500, 2500, "Hello world")];
        const matches: MatchEntry[] = [{ hebrewIndices: [0], englishIndices: [0], offset: 500 }];
        const chunks: SceneChunk[] = [{ hebrewStartIdx: 0, hebrewEndIdx: 0, medianOffset: 500 }];

        const result = applyTimingCorrections(heb, eng, matches, chunks, logger);
        expect(result[0].text).toBe("שלום עולם");
    });
});
