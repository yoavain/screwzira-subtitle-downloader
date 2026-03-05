import type { MatchEntry, SceneChunk } from "~src/sync/types";

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildChunk(matches: MatchEntry[], start: number, end: number): SceneChunk {
    const offsets = matches.slice(start, end + 1).map((m) => m.offset);
    return {
        hebrewStartIdx: matches[start].hebrewIndices[0],
        hebrewEndIdx: matches[end].hebrewIndices.at(-1),
        medianOffset: median(offsets)
    };
}

export function detectChunks(matches: MatchEntry[], thresholdMs: number): SceneChunk[] {
    if (matches.length === 0) return [];

    const chunks: SceneChunk[] = [];
    let chunkStart = 0;

    for (let i = 1; i < matches.length; i++) {
        const delta = Math.abs(matches[i].offset - matches[i - 1].offset);
        if (delta > thresholdMs) {
            chunks.push(buildChunk(matches, chunkStart, i - 1));
            chunkStart = i;
        }
    }
    chunks.push(buildChunk(matches, chunkStart, matches.length - 1));

    return chunks;
}
