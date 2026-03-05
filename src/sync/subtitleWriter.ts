import type { SubtitleEntry } from "~src/sync/types";

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
    return n.toString().padStart(3, "0");
}

export function formatTimestamp(ms: number): string {
    const msRem = ms % 1000;
    const totalSec = Math.floor(ms / 1000);
    const s = totalSec % 60;
    const totalMin = Math.floor(totalSec / 60);
    const m = totalMin % 60;
    const h = Math.floor(totalMin / 60);
    return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(msRem)}`;
}

export function writeSrt(entries: SubtitleEntry[]): string {
    return entries
        .map((e, i) => `${i + 1}\n${formatTimestamp(e.start)} --> ${formatTimestamp(e.end)}\n${e.text}`)
        .join("\n\n") + "\n";
}
