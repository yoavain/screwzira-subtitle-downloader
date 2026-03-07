import type { SubtitleEntry } from "~src/sync/types";

function parseTimestamp(ts: string): number {
    const [time, msStr] = ts.split(",");
    const [h, m, s] = time.split(":").map(Number);
    return (h * 3600 + m * 60 + s) * 1000 + Number(msStr);
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
        const text = lines.slice(2).join("\n");

        entries.push({ index, start, end, text });
    }

    return entries;
}

export function stripFormattingTags(text: string): string {
    return text.replace(/<[^>]+>/g, "").trim();
}
