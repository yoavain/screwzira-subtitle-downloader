import { repair, retime } from "~src/sync/retimer";
import type { SubtitleEntry, TimeWarp } from "~src/sync/types";

function entry(index: number, start: number, end: number, text = `line ${index}`): SubtitleEntry {
    return { index, start, end, text };
}

const oneSegment = (offset: number, endIdx: number): TimeWarp => ({
    segments: [{ startIdx: 0, endIdx, scale: 1, offset }],
    confidence: 1,
    overlapMs: 0
});

describe("repair", () => {
    it("leaves a well-formed list untouched", () => {
        const entries = [entry(1, 1000, 3000), entry(2, 4000, 6000), entry(3, 7000, 9000)];
        expect(repair(entries)).toEqual(entries);
    });

    it("restores monotonic start times", () => {
        const entries = [entry(1, 5000, 7000), entry(2, 3000, 4000)];
        const out = repair(entries);
        expect(out[1].start).toBeGreaterThanOrEqual(out[0].start);
    });

    it("truncates the earlier entry rather than moving the later one", () => {
        // Moving an entry off its dialogue is worse than shortening its predecessor.
        const entries = [entry(1, 1000, 8000), entry(2, 5000, 9000)];
        const out = repair(entries);
        expect(out[1].start).toBe(5000);
        expect(out[0].end).toBeLessThanOrEqual(5000);
    });

    it("enforces a minimum duration", () => {
        const entries = [entry(1, 1000, 1050)];
        expect(repair(entries, { minDurationMs: 500 })[0].end).toBe(1500);
    });

    it("never truncates an entry out of existence", () => {
        const entries = [entry(1, 5000, 9000), entry(2, 5000, 9000)];
        const out = repair(entries);
        expect(out[0].end).toBeGreaterThan(out[0].start);
        expect(out[1].end).toBeGreaterThan(out[1].start);
    });

    it("preserves an overlap that the original already had", () => {
        // Two speakers on screen at once is legitimate; squashing it changes what the file means.
        const original = [entry(1, 1000, 5000), entry(2, 2000, 5000)];
        const out = repair(original, {}, original);
        expect(out[0].end).toBe(5000);
        expect(out[1].start).toBe(2000);
    });

    it("still repairs an overlap that retiming introduced", () => {
        const original = [entry(1, 1000, 3000), entry(2, 4000, 6000)];
        const warped = [entry(1, 1000, 5000), entry(2, 4000, 6000)];
        const out = repair(warped, {}, original);
        expect(out[0].end).toBeLessThan(4000);
    });

    it("extends a too-short final entry that has no successor to collide with", () => {
        const entries = [entry(1, 1000, 3000), entry(2, 4000, 4010)];
        const out = repair(entries, { minDurationMs: 500 });
        expect(out[1].end - out[1].start).toBeGreaterThanOrEqual(500);
    });

    it("survives an empty list", () => {
        expect(repair([])).toEqual([]);
    });
});

describe("retime", () => {
    it("applies the segment offset and keeps text, order and count", () => {
        const entries = [entry(1, 1000, 3000, "aleph"), entry(2, 5000, 7000, "bet")];
        const out = retime(entries, oneSegment(2000, 1));

        expect(out).toHaveLength(2);
        expect(out.map((e) => e.text)).toEqual(["aleph", "bet"]);
        expect(out[0].start).toBe(3000);
        expect(out[1].start).toBe(7000);
    });

    it("applies scale as well as offset", () => {
        const entries = [entry(1, 1000, 2000)];
        const warp: TimeWarp = { segments: [{ startIdx: 0, endIdx: 0, scale: 2, offset: 500 }], confidence: 1, overlapMs: 0 };
        expect(retime(entries, warp)[0].start).toBe(2500);
    });

    it("applies different offsets either side of a cut", () => {
        const entries = [entry(1, 1000, 2000), entry(2, 3000, 4000), entry(3, 10_000, 11_000), entry(4, 12_000, 13_000)];
        const warp: TimeWarp = {
            segments: [
                { startIdx: 0, endIdx: 1, scale: 1, offset: 1000 },
                { startIdx: 2, endIdx: 3, scale: 1, offset: -5000 }
            ],
            confidence: 1,
            overlapMs: 0
        };
        const out = retime(entries, warp);

        expect(out[0].start).toBe(2000);
        expect(out[2].start).toBe(5000);
    });

    it("does not mutate its input", () => {
        const entries = [entry(1, 1000, 3000)];
        retime(entries, oneSegment(2000, 0));
        expect(entries[0].start).toBe(1000);
    });
});
