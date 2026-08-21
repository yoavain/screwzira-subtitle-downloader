/**
 * Stage 4 — apply the warp, then repair.
 *
 * Hebrew text, order, and entry count are immutable. Only timings change.
 *
 * The repair pass is a correctness requirement, not a refinement: a segment boundary can
 * place one entry before its predecessor, and snapping an entry to a reference start (in
 * Stage 2) can make it overlap its neighbour. Without repair the output can contain
 * inverted or overlapping entries, which players render badly or reject.
 */

import type { SubtitleEntry, TimeWarp } from "~src/sync/types";
import { applyWarp } from "~src/sync/timeWarp";

export interface RetimeOptions {
    /** Shortest permitted on-screen time. */
    minDurationMs?: number;
    /** Enforced blank time between consecutive entries. */
    minGapMs?: number;
}

const DEFAULTS: Required<RetimeOptions> = {
    minDurationMs: 500,
    minGapMs: 1
};

export function retime(entries: SubtitleEntry[], warp: TimeWarp, options: RetimeOptions = {}): SubtitleEntry[] {
    return repair(applyWarp(entries, warp), options, entries);
}

/**
 * Enforce, in order:
 *   start[i] >= start[i-1]
 *   end[i]   >= start[i] + minDurationMs
 *   end[i-1] <= start[i] - minGapMs
 *
 * A later entry never gets pushed backwards to satisfy an earlier one; the earlier entry
 * is truncated instead. Truncating is visually harmless, whereas moving an entry off its
 * dialogue is not.
 *
 * `original` lets the pass tell an inherited overlap from one that retiming introduced.
 * Real subtitles legitimately overlap — two speakers on screen at once — and squashing
 * that would change what the file means. The Office fixture has eight such pairs,
 * including one with two identical spans. Overlaps present in `original` are preserved;
 * only new ones are repaired. Omit `original` to enforce non-overlap everywhere.
 */
export function repair(entries: SubtitleEntry[], options: RetimeOptions = {}, original?: SubtitleEntry[]): SubtitleEntry[] {
    const { minDurationMs, minGapMs } = { ...DEFAULTS, ...options };
    const out = entries.map((entry) => ({ ...entry }));
    const inherited = (i: number): boolean =>
        !!original && i > 0 && i < original.length && original[i - 1].end > original[i].start;

    for (let i = 0; i < out.length; i++) {
        if (i > 0 && out[i].start < out[i - 1].start) {
            out[i].start = out[i - 1].start;
        }
        if (out[i].end < out[i].start + minDurationMs) {
            out[i].end = out[i].start + minDurationMs;
        }
        if (i > 0 && !inherited(i) && out[i - 1].end > out[i].start - minGapMs) {
            const truncated = out[i].start - minGapMs;
            // Never truncate an entry out of existence — give it at least a sliver.
            out[i - 1].end = Math.max(truncated, out[i - 1].start + 1);
        }
    }

    // The clamp above can leave the last entry shorter than the minimum; it has no successor
    // to collide with, so it can simply be extended.
    const last = out[out.length - 1];
    if (last && last.end < last.start + minDurationMs) {
        last.end = last.start + minDurationMs;
    }

    return out;
}
