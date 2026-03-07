 
/**
 * Scans all MKV files in a folder and reports subtitle track/file status.
 *
 * Usage (run from project root):
 *   node -r ts-node/register/transpile-only ./scripts/scan-mkv-subtitles.ts --folder <path>
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { MkvExtractor } from "../src/sync/mkvExtractor";
import type { LoggerInterface } from "../src/logger";
import { isExist } from "../src/fileUtils";

const MKVTOOLNIX_DIR = path.join(__dirname, "..", "resources", "mkvtoolnix");

const logger: LoggerInterface = {
    setLogLevel: () => {}, info: () => {}, debug: () => {}, verbose: () => {},
    warn: (msg) => console.warn("[WARN]", msg),
    error: (msg) => console.error("[ERROR]", msg),
    getLogFileLocation: () => ""
};

const mkvExtractor = new MkvExtractor(MKVTOOLNIX_DIR, logger);

const { values } = parseArgs({
    options: {
        folder: { type: "string" }
    },
    strict: true
});

if (!values.folder) {
    console.error("--folder is required");
    process.exit(1);
}

type Row = { filename: string; embeddedHebrew: boolean; embeddedEnglish: boolean; externalHebrew: boolean; externalEnglish: boolean };

function printTable(rows: Row[]) {
    const headers = ["filename", "embedded hebrew", "embedded english", "external hebrew", "external english"];
    const data = rows.map((r) => [
        r.filename,
        r.embeddedHebrew ? "✓" : "-",
        r.embeddedEnglish ? "✓" : "-",
        r.externalHebrew ? "✓" : "-",
        r.externalEnglish ? "✓" : "-"
    ]);

    const widths = headers.map((h, i) => Math.max(h.length, ...data.map((row) => row[i].length)));

    const leftAlign = (s: string, w: number) => s + " ".repeat(w - s.length);
    const centerAlign = (s: string, w: number) => {
        const gap = w - s.length;
        const l = Math.floor(gap / 2);
        return " ".repeat(l) + s + " ".repeat(gap - l);
    };
    const cell = (s: string, w: number, col: number) => ` ${col === 0 ? leftAlign(s, w) : centerAlign(s, w)} `;
    const row = (cells: string[]) => "│" + cells.map((c, i) => cell(c, widths[i], i)).join("│") + "│";
    const line = (l: string, m: string, r: string) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;

    console.log(line("┌", "┬", "┐"));
    console.log(row(headers));
    console.log(line("├", "┼", "┤"));
    for (const r of data) {
        console.log(row(r));
    }
    console.log(line("└", "┴", "┘"));
}

async function main() {
    const folder = values.folder!;
    const entries = await fs.promises.readdir(folder);
    const mkvFiles = entries.filter((e) => e.toLowerCase().endsWith(".mkv"));

    if (mkvFiles.length === 0) {
        console.log("No MKV files found in the specified folder.");
        return;
    }

    const rows = await Promise.all(
        mkvFiles.map(async (filename) => {
            const fullPath = path.join(folder, filename);
            const nameNoExt = filename.slice(0, -4);

            const [embeddedHebrew, embeddedEnglish, externalHebrew, externalEnglish] = await Promise.all([
                mkvExtractor.hasHebrewSubtitleTrack(fullPath),
                mkvExtractor.hasEnglishSubtitleTrack(fullPath),
                isExist(path.join(folder, nameNoExt + ".heb.srt")),
                isExist(path.join(folder, nameNoExt + ".eng.srt"))
            ]);

            return { filename, embeddedHebrew, embeddedEnglish, externalHebrew, externalEnglish };
        })
    );

    printTable(rows);
}

main().catch((err) => {
    console.error("[ERROR]", err.message);
    process.exit(1);
});
