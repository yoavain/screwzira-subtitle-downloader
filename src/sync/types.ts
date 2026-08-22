export interface SubtitleEntry {
    index: number;
    start: number; // milliseconds
    end: number; // milliseconds
    text: string; // may be multi-line, joined with \n
}

/** Minimal shape the timing stages need. SubtitleEntry is structurally compatible. */
export interface TimeSpan {
    start: number; // milliseconds
    end: number; // milliseconds
}

/**
 * A contiguous run of target entries sharing one linear time transform:
 *   t -> t * scale + offset
 * scale is 1 for a pure shift; it deviates only for framerate mismatch.
 */
export interface Segment {
    startIdx: number; // first target index, inclusive
    endIdx: number; // last target index, inclusive
    scale: number;
    offset: number; // milliseconds
}

export interface TimeWarp {
    segments: Segment[];
    /** Achieved overlap divided by total target duration. 0..1 — higher is better. */
    confidence: number;
    /** Total overlap in milliseconds, before the split penalty was charged. */
    overlapMs: number;
}
