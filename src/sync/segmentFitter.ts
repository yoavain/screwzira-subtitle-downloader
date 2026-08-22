/**
 * Split-penalty segmentation, shared by Stage 1 (timeWarp) and Stage 3 (refit).
 *
 * Given N items and K candidate offsets, assign one offset to each item so that the
 * total score is maximised, charging `splitPenalty` every time consecutive items
 * disagree. Without that penalty the optimum is degenerate: give every item its own
 * best offset, score perfectly, and describe nothing.
 *
 * Solved by dynamic programming over (item, offset). The inner "best previous offset
 * that is not this one" is obtained in O(1) per item from the best and second-best of
 * the previous row, which keeps the whole fit at O(N*K).
 */

export interface SplitFitInput {
    itemCount: number;
    offsetCount: number;
    /** Score for placing item `itemIdx` at candidate `offsetIdx`. Higher is better. */
    scoreAt: (itemIdx: number, offsetIdx: number) => number;
    /** Charged once per change of offset between consecutive items. Same units as scoreAt. */
    splitPenalty: number;
}

export interface FittedRun {
    startIdx: number; // inclusive
    endIdx: number; // inclusive
    offsetIdx: number;
}

export interface SplitFitResult {
    runs: FittedRun[];
    /** Sum of scoreAt along the chosen path, with split penalties already deducted. */
    totalScore: number;
}

const EMPTY_RESULT: SplitFitResult = { runs: [], totalScore: 0 };

export function fitSegments(input: SplitFitInput): SplitFitResult {
    const { itemCount, offsetCount, scoreAt, splitPenalty } = input;

    if (itemCount <= 0 || offsetCount <= 0) {
        return EMPTY_RESULT;
    }

    // from[i * offsetCount + c] = offset index used at item i-1 on the best path ending at (i, c)
    const from = new Int32Array(itemCount * offsetCount);
    let prev = new Float64Array(offsetCount);
    let cur = new Float64Array(offsetCount);

    for (let c = 0; c < offsetCount; c++) {
        prev[c] = scoreAt(0, c);
    }

    for (let i = 1; i < itemCount; i++) {
        // Best and second-best of the previous row, with their indices.
        let bestIdx = 0;
        let best = prev[0];
        let secondIdx = -1;
        let second = Number.NEGATIVE_INFINITY;
        for (let c = 1; c < offsetCount; c++) {
            const v = prev[c];
            if (v > best) {
                second = best;
                secondIdx = bestIdx;
                best = v;
                bestIdx = c;
            }
            else if (v > second) {
                second = v;
                secondIdx = c;
            }
        }

        const rowBase = i * offsetCount;
        for (let c = 0; c < offsetCount; c++) {
            // Switching in from any offset other than c.
            const switchFromIdx = c === bestIdx ? secondIdx : bestIdx;
            const switchFrom = switchFromIdx < 0
                ? Number.NEGATIVE_INFINITY
                : (c === bestIdx ? second : best) - splitPenalty;

            // Ties favour staying, which keeps the segment count minimal.
            if (prev[c] >= switchFrom) {
                cur[c] = prev[c] + scoreAt(i, c);
                from[rowBase + c] = c;
            }
            else {
                cur[c] = switchFrom + scoreAt(i, c);
                from[rowBase + c] = switchFromIdx;
            }
        }

        const swap = prev;
        prev = cur;
        cur = swap;
    }

    let endIdx = 0;
    for (let c = 1; c < offsetCount; c++) {
        if (prev[c] > prev[endIdx]) {
            endIdx = c;
        }
    }
    const totalScore = prev[endIdx];

    // Walk the path backwards, collecting the offset chosen at each item.
    const path = new Int32Array(itemCount);
    path[itemCount - 1] = endIdx;
    for (let i = itemCount - 1; i > 0; i--) {
        path[i - 1] = from[i * offsetCount + path[i]];
    }

    const runs: FittedRun[] = [];
    let runStart = 0;
    for (let i = 0; i < itemCount; i++) {
        const isLast = i === itemCount - 1;
        if (isLast || path[i + 1] !== path[i]) {
            runs.push({ startIdx: runStart, endIdx: i, offsetIdx: path[i] });
            runStart = i + 1;
        }
    }

    return { runs, totalScore };
}

/**
 * Drop runs shorter than `minRun` by folding them into a neighbour.
 *
 * A genuine cut shifts everything after it, so a one- or two-entry island is an outlier,
 * not a cut. Without this, a single unusually long entry with no counterpart — a
 * translator credit, a title card, a song — can pay for its own segment simply by being
 * long enough to recover more overlap than the split penalty costs.
 *
 * Folding is done as a post-pass rather than as a DP constraint: tracking run length in
 * the state would cost a factor of minRun in time and memory for a case that is rare and
 * cheap to clean up afterwards.
 */
export function mergeShortRuns(
    runs: FittedRun[],
    minRun: number,
    scoreAt: (itemIdx: number, offsetIdx: number) => number
): FittedRun[] {
    if (runs.length <= 1 || minRun <= 1) {
        return runs;
    }

    let current = runs.map((run) => ({ ...run }));

    for (;;) {
        const shortIdx = current.findIndex((run) => run.endIdx - run.startIdx + 1 < minRun);
        if (shortIdx < 0 || current.length <= 1) {
            break;
        }

        const left = current[shortIdx - 1];
        const right = current[shortIdx + 1];
        const target = !left ? right : !right ? left : preferred(current[shortIdx], left, right, scoreAt);

        target.startIdx = Math.min(target.startIdx, current[shortIdx].startIdx);
        target.endIdx = Math.max(target.endIdx, current[shortIdx].endIdx);
        current.splice(shortIdx, 1);
        current = coalesce(current);
    }

    return current;
}

function preferred(
    run: FittedRun,
    left: FittedRun,
    right: FittedRun,
    scoreAt: (itemIdx: number, offsetIdx: number) => number
): FittedRun {
    let leftScore = 0;
    let rightScore = 0;
    for (let i = run.startIdx; i <= run.endIdx; i++) {
        leftScore += scoreAt(i, left.offsetIdx);
        rightScore += scoreAt(i, right.offsetIdx);
    }
    return leftScore >= rightScore ? left : right;
}

/** Fuse adjacent runs that ended up on the same offset. */
function coalesce(runs: FittedRun[]): FittedRun[] {
    const out: FittedRun[] = [];
    for (const run of runs) {
        const last = out[out.length - 1];
        if (last && last.offsetIdx === run.offsetIdx && last.endIdx + 1 === run.startIdx) {
            last.endIdx = run.endIdx;
        }
        else {
            out.push({ ...run });
        }
    }
    return out;
}
