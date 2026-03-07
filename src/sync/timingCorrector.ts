import type { SubtitleEntry, MatchEntry, SceneChunk } from "~src/sync/types";
import type { LoggerInterface } from "~src/logger";

function getChunkOffset(hebIdx: number, chunks: SceneChunk[]): number | null {
    const chunk = chunks.find((c) => hebIdx >= c.hebrewStartIdx && hebIdx <= c.hebrewEndIdx);
    return chunk ? chunk.medianOffset : null;
}

export function applyTimingCorrections(
    hebEntries: SubtitleEntry[],
    engEntries: SubtitleEntry[],
    matches: MatchEntry[],
    chunks: SceneChunk[],
    logger: LoggerInterface
): SubtitleEntry[] {
    const matchByHebIdx = new Map<number, MatchEntry>();
    for (const match of matches) {
        for (const idx of match.hebrewIndices) {
            matchByHebIdx.set(idx, match);
        }
    }

    return hebEntries.map((heb, i) => {
        const match = matchByHebIdx.get(i);

        if (!match) {
            logger.warn(`Sync: Unmatched Hebrew line index ${i}. Keeping original timing.`);
            return { ...heb };
        }

        const { hebrewIndices, englishIndices } = match;

        if (hebrewIndices.length === 1 && englishIndices.length === 1) {
            const offset = getChunkOffset(i, chunks) ?? match.offset;
            return { ...heb, start: Math.round(heb.start + offset), end: Math.round(heb.end + offset) };
        }

        if (hebrewIndices.length === 1 && englishIndices.length > 1) {
            const engSpan = englishIndices.map((idx) => engEntries[idx]).filter(Boolean);
            if (!engSpan.length) {
                return { ...heb };
            }
            const newStart = Math.min(...engSpan.map((e) => e.start));
            const newEnd = Math.max(...engSpan.map((e) => e.end));
            return { ...heb, start: newStart, end: newEnd };
        }

        if (hebrewIndices.length === 2 && englishIndices.length === 1) {
            const eng = engEntries[englishIndices[0]];
            if (!eng) {
                return { ...heb };
            }
            const engMidpoint = Math.floor((eng.start + eng.end) / 2);
            const positionInMerge = hebrewIndices.indexOf(i);
            if (positionInMerge === 0) {
                return { ...heb, start: eng.start, end: engMidpoint };
            }
            else {
                return { ...heb, start: engMidpoint, end: eng.end };
            }
        }

        // Fallback for larger n:m merges — apply chunk offset
        const offset = getChunkOffset(i, chunks) ?? match.offset;
        return { ...heb, start: Math.round(heb.start + offset), end: Math.round(heb.end + offset) };
    });
}
