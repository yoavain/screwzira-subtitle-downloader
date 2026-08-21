/**
 * Shared scorer for every sync harness: offline, Ollama integration, and the model bake-off.
 * A fixture is judged by these numbers rather than by hand-written per-case assertions.
 */

import type { SubtitleEntry } from "~src/sync/types";

export interface SyncScore {
    medianAbsStartErrorMs: number;
    p90AbsStartErrorMs: number;
    maxAbsStartErrorMs: number;
    /** Fraction of entries within thresholdMs of ground truth — the number that tracks "feels in sync". */
    withinThresholdRatio: number;
    entryCount: number;
}

export const DEFAULT_THRESHOLD_MS = 150;

export function scoreSync(corrected: SubtitleEntry[], groundTruth: SubtitleEntry[], thresholdMs: number = DEFAULT_THRESHOLD_MS): SyncScore {
    if (corrected.length !== groundTruth.length) {
        throw new Error(`scoreSync: entry count mismatch — corrected=${corrected.length} groundTruth=${groundTruth.length}`);
    }
    if (corrected.length === 0) {
        return { medianAbsStartErrorMs: 0, p90AbsStartErrorMs: 0, maxAbsStartErrorMs: 0, withinThresholdRatio: 1, entryCount: 0 };
    }

    const errors = corrected.map((entry, i) => Math.abs(entry.start - groundTruth[i].start)).sort((a, b) => a - b);
    const within = errors.filter((e) => e <= thresholdMs).length;

    return {
        medianAbsStartErrorMs: percentile(errors, 0.5),
        p90AbsStartErrorMs: percentile(errors, 0.9),
        maxAbsStartErrorMs: errors[errors.length - 1],
        withinThresholdRatio: within / errors.length,
        entryCount: errors.length
    };
}

/**
 * Structural invariants that must hold for any output, even with no ground truth.
 *
 * Overlaps that `original` already had are allowed through: real subtitles legitimately
 * put two speakers on screen at once, and the repair pass deliberately preserves that.
 */
export function assertWellFormed(corrected: SubtitleEntry[], original: SubtitleEntry[], minGapMs = 0): void {
    expect(corrected).toHaveLength(original.length);
    for (let i = 0; i < corrected.length; i++) {
        expect(corrected[i].text).toBe(original[i].text);
        expect(corrected[i].end).toBeGreaterThan(corrected[i].start);
        if (i > 0) {
            expect(corrected[i].start).toBeGreaterThanOrEqual(corrected[i - 1].start);
            const inheritedOverlap = original[i - 1].end > original[i].start;
            if (!inheritedOverlap) {
                expect(corrected[i - 1].end).toBeLessThanOrEqual(corrected[i].start - minGapMs);
            }
        }
    }
}

function percentile(sorted: number[], p: number): number {
    const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
    return sorted[idx];
}
