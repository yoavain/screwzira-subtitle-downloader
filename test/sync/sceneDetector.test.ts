import { detectChunks } from "~src/sync/sceneDetector";
import type { MatchEntry } from "~src/sync/types";

function makeMatch(hebIdx: number, offset: number): MatchEntry {
    return { hebrewIndices: [hebIdx], englishIndices: [hebIdx], offset };
}

describe("detectChunks", () => {
    it("returns empty array for no matches", () => {
        expect(detectChunks([], 300)).toHaveLength(0);
    });

    it("returns single chunk when all offsets are within threshold", () => {
        const matches: MatchEntry[] = [
            makeMatch(0, 1000),
            makeMatch(1, 1050),
            makeMatch(2, 980),
            makeMatch(3, 1020)
        ];
        const chunks = detectChunks(matches, 300);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].hebrewStartIdx).toBe(0);
        expect(chunks[0].hebrewEndIdx).toBe(3);
    });

    it("splits into two chunks when offset delta exceeds threshold", () => {
        const matches: MatchEntry[] = [
            makeMatch(0, 1000),
            makeMatch(1, 1010),
            makeMatch(2, 2000),  // scene boundary
            makeMatch(3, 2010)
        ];
        const chunks = detectChunks(matches, 300);
        expect(chunks).toHaveLength(2);
        expect(chunks[0].hebrewStartIdx).toBe(0);
        expect(chunks[0].hebrewEndIdx).toBe(1);
        expect(chunks[1].hebrewStartIdx).toBe(2);
        expect(chunks[1].hebrewEndIdx).toBe(3);
    });

    it("computes median offset correctly for odd count", () => {
        const matches: MatchEntry[] = [
            makeMatch(0, 100),
            makeMatch(1, 200),
            makeMatch(2, 300)
        ];
        const chunks = detectChunks(matches, 500);
        expect(chunks[0].medianOffset).toBe(200);
    });

    it("computes median offset correctly for even count", () => {
        const matches: MatchEntry[] = [
            makeMatch(0, 100),
            makeMatch(1, 200)
        ];
        const chunks = detectChunks(matches, 500);
        expect(chunks[0].medianOffset).toBe(150);
    });

    it("uses median not mean (resistant to outliers)", () => {
        const matches: MatchEntry[] = [
            makeMatch(0, 1000),
            makeMatch(1, 1000),
            makeMatch(2, 1000),
            makeMatch(3, 9000)  // outlier within threshold to stay in chunk
        ];
        const chunks = detectChunks(matches, 10000);
        expect(chunks).toHaveLength(1);
        // median of [1000, 1000, 1000, 9000] = (1000+1000)/2 = 1000
        expect(chunks[0].medianOffset).toBe(1000);
    });

    it("handles single match entry", () => {
        const matches: MatchEntry[] = [makeMatch(5, 1500)];
        const chunks = detectChunks(matches, 300);
        expect(chunks).toHaveLength(1);
        expect(chunks[0].hebrewStartIdx).toBe(5);
        expect(chunks[0].hebrewEndIdx).toBe(5);
        expect(chunks[0].medianOffset).toBe(1500);
    });
});
