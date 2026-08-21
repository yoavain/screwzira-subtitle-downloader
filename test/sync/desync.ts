/**
 * De-sync transforms for fixture-driven tests.
 *
 * A fixture is a pair of subtitles already correctly timed for the same release. We
 * deliberately break the target's timings with a known transform, run the pipeline, and
 * compare against the original. Ground truth therefore needs no manual alignment labels,
 * and one fetched pair yields many scenarios.
 */

import type { SubtitleEntry } from "~src/sync/types";

export type DesyncTransform =
    /** Every entry moves by the same amount. The common real-world case. */
    | { type: "constant"; ms: number }
    /** A step change at each point, modelling an ad break or a director's cut. */
    | { type: "cuts"; baseMs?: number; points: readonly { readonly atMs: number; readonly deltaMs: number }[] }
    /** Playback-speed mismatch: t -> t * factor. 23.976 vs 25 fps is factor 25/23.976. */
    | { type: "scale"; factor: number }
    /** Error grows linearly from fromMs at t=0 to toMs at the last entry. */
    | { type: "drift"; fromMs: number; toMs: number };

export function applyDesync(entries: SubtitleEntry[], transform: DesyncTransform): SubtitleEntry[] {
    const shift = shiftFor(entries, transform);
    return entries.map((entry) => ({
        ...entry,
        start: Math.round(shift(entry.start)),
        end: Math.round(shift(entry.end))
    }));
}

/** The inverse of what applyDesync did, per timestamp — useful for asserting recovery. */
function shiftFor(entries: SubtitleEntry[], transform: DesyncTransform): (t: number) => number {
    switch (transform.type) {
        case "constant":
            return (t) => t + transform.ms;

        case "cuts": {
            const points = [...transform.points].sort((a, b) => a.atMs - b.atMs);
            const base = transform.baseMs ?? 0;
            return (t) => {
                let delta = base;
                for (const point of points) {
                    if (t >= point.atMs) {
                        delta += point.deltaMs;
                    }
                }
                return t + delta;
            };
        }

        case "scale":
            return (t) => t * transform.factor;

        case "drift": {
            const span = entries[entries.length - 1]?.end ?? 0;
            const range = transform.toMs - transform.fromMs;
            return span === 0
                ? (t) => t + transform.fromMs
                : (t) => t + transform.fromMs + (range * t) / span;
        }
    }
}

