/**
 * Stage 1 — timing synchronisation. No AI, no text.
 *
 * Both subtitle files describe the same dialogue, so both light up when someone speaks
 * and go dark during silence. That on/off rhythm is a fingerprint: slide one over the
 * other and the correct offset is where overlap peaks.
 *
 * A single offset cannot describe an ad break or a director's cut, so the timeline may
 * split into segments with independent offsets, at a fixed cost per split
 * (see segmentFitter). Framerate mismatch is handled by scanning a small set of ratios.
 *
 * This is the problem `alass` solves; the formulation here follows it.
 */

import type { Segment, SubtitleEntry, TimeSpan, TimeWarp } from "~src/sync/types";
import { fitSegments, mergeShortRuns } from "~src/sync/segmentFitter";

export interface TimeWarpOptions {
    /** Overlap in milliseconds that a new segment must recover to be worth creating. */
    splitPenaltyMs?: number;
    /** Largest shift considered, in milliseconds. */
    maxOffsetMs?: number;
    /** Candidate offsets are rounded to this grid before being counted. */
    offsetBinMs?: number;
    /** How many of the most-voted candidate offsets survive into the fit. */
    maxCandidateOffsets?: number;
    /** Playback-speed ratios to scan. 1 is always included. */
    framerateRatios?: number[];
    /** Shortest run of entries that may form its own segment. Below this, it is an outlier, not a cut. */
    minSegmentEntries?: number;
}

const DEFAULTS = {
    splitPenaltyMs: 7000,
    maxOffsetMs: 180_000,
    offsetBinMs: 20,
    maxCandidateOffsets: 200,
    // Authored-for over played-at, both directions, for the frame rates that occur in practice.
    framerateRatios: [1, 23.976 / 25, 25 / 23.976, 23.976 / 24, 24 / 23.976, 24 / 25, 25 / 24, 29.97 / 30, 30 / 29.97],
    minSegmentEntries: 3
};

/**
 * Score fraction within which two fits count as explaining the data equally well.
 *
 * Needed because a framerate error is closely approximated by a handful of piecewise
 * shifts: on a real fixture, a 4.27 % rate error scored *better* under scale 1 with four
 * segments (799 956) than under the true ratio with one (798 264). Raw score alone
 * therefore picks the wrong model. Inside this band the simpler model wins — see
 * pickBest.
 */
const TIE_MARGIN = 0.02;

const IDENTITY_SEGMENT: Segment = { startIdx: 0, endIdx: 0, scale: 1, offset: 0 };

export function warpTime(t: number, segment: Segment): number {
    return t * segment.scale + segment.offset;
}

export function applyWarp(entries: SubtitleEntry[], warp: TimeWarp): SubtitleEntry[] {
    return entries.map((entry, i) => {
        const segment = segmentFor(i, warp.segments);
        return {
            ...entry,
            start: Math.round(warpTime(entry.start, segment)),
            end: Math.round(warpTime(entry.end, segment))
        };
    });
}

export function segmentFor(index: number, segments: Segment[]): Segment {
    for (const segment of segments) {
        if (index >= segment.startIdx && index <= segment.endIdx) {
            return segment;
        }
    }
    // Outside every segment — extrapolate from the nearest one.
    if (segments.length === 0) {
        return IDENTITY_SEGMENT;
    }
    return index < segments[0].startIdx ? segments[0] : segments[segments.length - 1];
}

export function timeWarp(target: TimeSpan[], reference: TimeSpan[], options: TimeWarpOptions = {}): TimeWarp {
    const opts = { ...DEFAULTS, ...options };

    const targetDuration = target.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
    if (target.length === 0 || reference.length === 0 || targetDuration === 0) {
        return { segments: [{ startIdx: 0, endIdx: Math.max(0, target.length - 1), scale: 1, offset: 0 }], confidence: 0, overlapMs: 0 };
    }

    const refStarts = Float64Array.from(reference, (s) => s.start);
    const refEnds = Float64Array.from(reference, (s) => s.end);

    // Every ratio gets the full split-penalty fit.
    //
    // An earlier version ranked ratios by their best *single* offset and fitted only the
    // top two. That ranking breaks precisely when it matters: with an ad break, no single
    // offset explains the file, so the correct ratio scores low and loses to a stretch that
    // happens to line up somewhere. Ranking cost a full n*K sweep anyway — the same as the
    // fit — so the two-pass structure bought nothing and lost correctness.
    const candidates: { warp: TimeWarp; score: number; ratio: number }[] = [];

    for (const ratio of opts.framerateRatios) {
        const scaled = scaleSpans(target, ratio);
        const offsets = candidateOffsets(scaled, refStarts, opts);
        if (offsets.length === 0) {
            continue;
        }

        const scoreAt = (i: number, c: number): number =>
            spanOverlap(scaled[i].start + offsets[c], scaled[i].end + offsets[c], refStarts, refEnds);

        const fit = fitSegments({
            itemCount: scaled.length,
            offsetCount: offsets.length,
            scoreAt,
            splitPenalty: opts.splitPenaltyMs
        });
        const runs = mergeShortRuns(fit.runs, opts.minSegmentEntries, scoreAt);

        const segments: Segment[] = runs.map((run) => ({
            startIdx: run.startIdx,
            endIdx: run.endIdx,
            scale: ratio,
            offset: refineOffset(scaled, run.startIdx, run.endIdx, offsets[run.offsetIdx], refStarts, refEnds, opts.offsetBinMs)
        }));

        const overlapMs = segments.reduce(
            (sum, segment) => sum + rangeOverlap(scaled, segment.startIdx, segment.endIdx, segment.offset, refStarts, refEnds),
            0
        );
        // Normalise by the SCALED duration, not the original.
        //
        // Scaling the target stretches every entry, so a ratio of 1.04 inflates the total
        // overlap available by about 4 % before any alignment happens. Comparing raw
        // millisecond scores across ratios therefore rewards stretching for its own sake:
        // on a real fixture, two further stretches of an already-stretched file outscored
        // the ratio that actually corrected it. Working in fractions of target duration
        // makes the ratios comparable.
        const scaledDuration = targetDuration * ratio;
        candidates.push({
            warp: { segments, confidence: Math.min(1, overlapMs / scaledDuration), overlapMs },
            score: (overlapMs - opts.splitPenaltyMs * (segments.length - 1)) / scaledDuration,
            ratio
        });
    }

    return pickBest(candidates) ?? { segments: [{ startIdx: 0, endIdx: target.length - 1, scale: 1, offset: 0 }], confidence: 0, overlapMs: 0 };
}

/**
 * Highest score wins, except that fits within TIE_MARGIN of it count as equally good. Among
 * those, prefer the simpler explanation: fewer segments first, then no stretch over a
 * stretch. Four shifts imitating a framerate error score about the same as the one scale
 * that actually describes it, and the one-parameter answer is the one more likely to be true.
 */
function pickBest(candidates: { warp: TimeWarp; score: number; ratio: number }[]): TimeWarp | null {
    if (candidates.length === 0) {
        return null;
    }

    const topScore = Math.max(...candidates.map((c) => c.score));
    const threshold = topScore - TIE_MARGIN * Math.abs(topScore);

    const tied = candidates.filter((c) => c.score >= threshold);
    tied.sort((a, b) => {
        const bySegments = a.warp.segments.length - b.warp.segments.length;
        if (bySegments !== 0) {
            return bySegments;
        }
        const byStretch = Number(a.ratio !== 1) - Number(b.ratio !== 1);
        return byStretch !== 0 ? byStretch : b.score - a.score;
    });

    return tied[0].warp;
}

function scaleSpans(spans: TimeSpan[], ratio: number): TimeSpan[] {
    return ratio === 1 ? spans : spans.map((s) => ({ start: s.start * ratio, end: s.end * ratio }));
}

/**
 * The offsets worth considering are those that make target and reference boundaries
 * coincide. Votes are weighted by the overlap such a pairing could contribute, so long
 * lines count for more than one-word interjections.
 */
function candidateOffsets(target: TimeSpan[], refStarts: Float64Array, opts: Required<TimeWarpOptions>): number[] {
    const votes = new Map<number, number>();

    for (const span of target) {
        const duration = span.end - span.start;
        if (duration <= 0) {
            continue;
        }
        let j = lowerBound(refStarts, span.start - opts.maxOffsetMs);
        const limit = span.start + opts.maxOffsetMs;
        for (; j < refStarts.length && refStarts[j] <= limit; j++) {
            const bin = Math.round((refStarts[j] - span.start) / opts.offsetBinMs);
            votes.set(bin, (votes.get(bin) ?? 0) + duration);
        }
    }

    return [...votes.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, opts.maxCandidateOffsets)
        .map(([bin]) => bin * opts.offsetBinMs);
}

/**
 * The fit picks offsets from a coarse grid. Sharpen each segment by taking the median
 * boundary difference of the reference spans it actually landed on.
 */
function refineOffset(
    target: TimeSpan[],
    startIdx: number,
    endIdx: number,
    offset: number,
    refStarts: Float64Array,
    refEnds: Float64Array,
    binMs: number
): number {
    const diffs: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
        const j = bestOverlappingRef(target[i].start + offset, target[i].end + offset, refStarts, refEnds);
        if (j >= 0) {
            diffs.push(refStarts[j] - target[i].start);
        }
    }
    if (diffs.length === 0) {
        return offset;
    }
    const refined = median(diffs);
    // Guard against a refinement that a sparse or noisy segment made worse.
    return Math.abs(refined - offset) > binMs * 4 ? offset : refined;
}

function rangeOverlap(
    target: TimeSpan[],
    startIdx: number,
    endIdx: number,
    offset: number,
    refStarts: Float64Array,
    refEnds: Float64Array
): number {
    let sum = 0;
    for (let i = startIdx; i <= endIdx; i++) {
        sum += spanOverlap(target[i].start + offset, target[i].end + offset, refStarts, refEnds);
    }
    return sum;
}

function totalOverlap(target: TimeSpan[], offset: number, refStarts: Float64Array, refEnds: Float64Array): number {
    return rangeOverlap(target, 0, target.length - 1, offset, refStarts, refEnds);
}

/** Milliseconds of [start, end) covered by any reference span. */
function spanOverlap(start: number, end: number, refStarts: Float64Array, refEnds: Float64Array): number {
    let sum = 0;
    for (let j = firstCandidate(refStarts, refEnds, start); j < refStarts.length && refStarts[j] < end; j++) {
        const lo = refStarts[j] > start ? refStarts[j] : start;
        const hi = refEnds[j] < end ? refEnds[j] : end;
        if (hi > lo) {
            sum += hi - lo;
        }
    }
    return sum;
}

function bestOverlappingRef(start: number, end: number, refStarts: Float64Array, refEnds: Float64Array): number {
    let bestIdx = -1;
    let bestValue = 0;
    for (let j = firstCandidate(refStarts, refEnds, start); j < refStarts.length && refStarts[j] < end; j++) {
        const lo = refStarts[j] > start ? refStarts[j] : start;
        const hi = refEnds[j] < end ? refEnds[j] : end;
        if (hi - lo > bestValue) {
            bestValue = hi - lo;
            bestIdx = j;
        }
    }
    return bestIdx;
}

/**
 * Index of the first reference span that could overlap a window starting at `start`.
 * Spans are sorted by start and are non-overlapping, so stepping back one from the
 * first start greater than `start` is enough to catch a span already in progress.
 */
function firstCandidate(refStarts: Float64Array, refEnds: Float64Array, start: number): number {
    const j = lowerBound(refStarts, start);
    return j > 0 && refEnds[j - 1] > start ? j - 1 : j;
}

/** First index whose value is >= target. */
function lowerBound(values: Float64Array, target: number): number {
    let lo = 0;
    let hi = values.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (values[mid] < target) {
            lo = mid + 1;
        }
        else {
            hi = mid;
        }
    }
    return lo;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
