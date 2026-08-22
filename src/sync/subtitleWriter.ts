import type { SubtitleEntry } from "~src/sync/types";

function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

function pad3(n: number): string {
    return n.toString().padStart(3, "0");
}

/**
 * SRT cannot express a negative or non-finite time, so both are floored to zero here as a
 * last line of defence. The repair pass in retimer.ts is what should normally prevent them;
 * this guard exists so a bug upstream degrades to a wrong-but-valid file rather than one
 * that reads "-1:-1:-1,-500" or "NaN:NaN:NaN,NaN" and that no player will load.
 */
export function formatTimestamp(ms: number): string {
    if (!Number.isFinite(ms) || ms < 0) {
        ms = 0;
    }
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
