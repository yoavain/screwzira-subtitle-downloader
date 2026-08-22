import type { SubtitleEntry } from "~src/sync/types";

/**
 * `HH:MM:SS,mmm` only. A WebVTT file saved as `.srt` uses a dot for the fraction, which used
 * to slip past the block-shape checks and produce NaN — and NaN survived all the way to the
 * writer, which emitted "NaN:NaN:NaN,NaN" over the user's file. Returning null instead lets
 * parseSrt drop the block, so a malformed line costs one entry rather than the whole file.
 *
 * Hours are allowed more than two digits; some tools emit them that way. Minutes and seconds
 * are not, because "00:1:2,000" means the file is not SRT at all.
 */
const TIMESTAMP = /^(\d+):([0-5]\d):([0-5]\d),(\d{1,3})$/;

function parseTimestamp(ts: string): number | null {
    const match = TIMESTAMP.exec(ts.trim());
    if (!match) {
        return null;
    }
    const [, h, m, s, ms] = match;
    return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000 + Number(ms.padEnd(3, "0"));
}

export function parseSrt(content: string): SubtitleEntry[] {
    const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    const blocks = normalized.split(/\n{2,}/);
    const entries: SubtitleEntry[] = [];

    for (const block of blocks) {
        const lines = block.trim().split("\n");
        if (lines.length < 2) {
            continue;
        }

        const index = parseInt(lines[0], 10);
        if (isNaN(index)) {
            continue;
        }

        const timeLine = lines[1];
        const arrowIdx = timeLine.indexOf(" --> ");
        if (arrowIdx < 0) {
            continue;
        }

        const startStr = timeLine.slice(0, arrowIdx).trim();
        const endStr = timeLine.slice(arrowIdx + 5).trim();
        const start = parseTimestamp(startStr);
        const end = parseTimestamp(endStr);
        if (start === null || end === null) {
            continue;
        }
        const text = lines.slice(2).join("\n");

        entries.push({ index, start, end, text });
    }

    return entries;
}
