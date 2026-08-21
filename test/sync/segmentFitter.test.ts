import { fitSegments, mergeShortRuns } from "~src/sync/segmentFitter";
import type { FittedRun } from "~src/sync/segmentFitter";

/**
 * Scores are built from a "truth" array: item i really belongs at truth[i], and scoring it
 * there pays `reward`. Anything else pays 0. The split penalty then decides whether the
 * fit is allowed to follow the truth or must flatten it.
 */
function scorerFor(truth: number[], reward = 100) {
    return (itemIdx: number, offsetIdx: number): number => (truth[itemIdx] === offsetIdx ? reward : 0);
}

function offsetsOf(runs: FittedRun[]): number[] {
    return runs.map((r) => r.offsetIdx);
}

describe("fitSegments", () => {
    it("returns one run when every item agrees", () => {
        const truth = Array.from({ length: 20 }, () => 1);
        const { runs } = fitSegments({ itemCount: 20, offsetCount: 3, scoreAt: scorerFor(truth), splitPenalty: 100 });

        expect(runs).toHaveLength(1);
        expect(runs[0]).toEqual({ startIdx: 0, endIdx: 19, offsetIdx: 1 });
    });

    it("splits when the gain clearly exceeds the penalty", () => {
        const truth = [...Array<number>(10).fill(0), ...Array<number>(10).fill(2)];
        const { runs } = fitSegments({ itemCount: 20, offsetCount: 3, scoreAt: scorerFor(truth), splitPenalty: 100 });

        expect(runs).toHaveLength(2);
        expect(runs[0].endIdx).toBe(9);
        expect(runs[1].startIdx).toBe(10);
        expect(offsetsOf(runs)).toEqual([0, 2]);
    });

    it("refuses to split when the penalty outweighs the gain", () => {
        // Ten items x 100 reward = 1000 gain, against a 5000 penalty.
        const truth = [...Array<number>(10).fill(0), ...Array<number>(10).fill(2)];
        const { runs } = fitSegments({ itemCount: 20, offsetCount: 3, scoreAt: scorerFor(truth), splitPenalty: 5000 });

        expect(runs).toHaveLength(1);
    });

    it("splits freely at zero penalty", () => {
        const truth = [0, 1, 2, 0, 1, 2];
        const { runs } = fitSegments({ itemCount: 6, offsetCount: 3, scoreAt: scorerFor(truth), splitPenalty: 0 });

        expect(offsetsOf(runs)).toEqual(truth);
    });

    it("ignores a single outlier inside a run", () => {
        const truth = Array.from({ length: 20 }, () => 1);
        truth[7] = 2; // one bad item must not carve out its own segment
        const { runs } = fitSegments({ itemCount: 20, offsetCount: 3, scoreAt: scorerFor(truth), splitPenalty: 500 });

        expect(runs).toHaveLength(1);
        expect(runs[0].offsetIdx).toBe(1);
    });

    it("prefers staying on ties, keeping the segment count minimal", () => {
        const { runs } = fitSegments({ itemCount: 10, offsetCount: 3, scoreAt: () => 50, splitPenalty: 0 });
        expect(runs).toHaveLength(1);
    });

    it("reports rawScore without the penalty and totalScore with it", () => {
        const truth = [...Array<number>(5).fill(0), ...Array<number>(5).fill(1)];
        const result = fitSegments({ itemCount: 10, offsetCount: 2, scoreAt: scorerFor(truth), splitPenalty: 100 });

        expect(result.rawScore).toBe(1000);
        expect(result.totalScore).toBe(900);
    });

    it("handles a single item and a single offset", () => {
        expect(fitSegments({ itemCount: 1, offsetCount: 1, scoreAt: () => 5, splitPenalty: 1 }).runs).toEqual([
            { startIdx: 0, endIdx: 0, offsetIdx: 0 }
        ]);
    });

    it("returns nothing for empty input", () => {
        expect(fitSegments({ itemCount: 0, offsetCount: 3, scoreAt: () => 0, splitPenalty: 1 }).runs).toEqual([]);
        expect(fitSegments({ itemCount: 3, offsetCount: 0, scoreAt: () => 0, splitPenalty: 1 }).runs).toEqual([]);
    });
});

describe("mergeShortRuns", () => {
    const runs = (spec: [number, number, number][]): FittedRun[] =>
        spec.map(([startIdx, endIdx, offsetIdx]) => ({ startIdx, endIdx, offsetIdx }));

    it("folds a one-item island into a neighbour", () => {
        // A real cut shifts everything after it, so a lone item is an outlier, not a cut.
        const input = runs([[0, 0, 5], [1, 30, 1]]);
        const merged = mergeShortRuns(input, 3, () => 0);

        expect(merged).toHaveLength(1);
        expect(merged[0]).toEqual({ startIdx: 0, endIdx: 30, offsetIdx: 1 });
    });

    it("folds into whichever neighbour scores the island better", () => {
        const input = runs([[0, 9, 0], [10, 10, 5], [11, 20, 2]]);
        const merged = mergeShortRuns(input, 3, (_i, offsetIdx) => (offsetIdx === 2 ? 100 : 0));

        expect(merged).toHaveLength(2);
        expect(merged[1]).toEqual({ startIdx: 10, endIdx: 20, offsetIdx: 2 });
    });

    it("leaves runs at or above the minimum alone", () => {
        const input = runs([[0, 4, 0], [5, 9, 1]]);
        expect(mergeShortRuns(input, 3, () => 0)).toEqual(input);
    });

    it("coalesces neighbours that end up on the same offset", () => {
        const input = runs([[0, 9, 1], [10, 10, 5], [11, 20, 1]]);
        const merged = mergeShortRuns(input, 3, () => 0);

        expect(merged).toHaveLength(1);
        expect(merged[0]).toEqual({ startIdx: 0, endIdx: 20, offsetIdx: 1 });
    });

    it("collapses to one run when every run is short", () => {
        const input = runs([[0, 0, 0], [1, 1, 1], [2, 2, 2]]);
        expect(mergeShortRuns(input, 3, () => 0)).toHaveLength(1);
    });

    it("is a no-op for a single run or a minimum of one", () => {
        const single = runs([[0, 0, 0]]);
        expect(mergeShortRuns(single, 3, () => 0)).toEqual(single);

        const many = runs([[0, 0, 0], [1, 1, 1]]);
        expect(mergeShortRuns(many, 1, () => 0)).toEqual(many);
    });
});
