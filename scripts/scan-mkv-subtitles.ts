/**
 * Scans MKV files and reports whether each one can serve as a sync test candidate.
 *
 * Sync needs a *text* reference track (S_TEXT/UTF8, ASS, SSA). Blu-ray releases almost
 * always carry PGS instead, which is images of text and unusable without OCR — so this
 * distinguishes "no track" from "present but bitmap only", which is the question that
 * actually matters when hunting for fixtures.
 *
 * Usage (run from project root):
 *   node -r ts-node/register/transpile-only ./scripts/scan-mkv-subtitles.ts --folder <path>
 *   node -r ts-node/register/transpile-only ./scripts/scan-mkv-subtitles.ts --folder <path> --recursive
 *   node -r ts-node/register/transpile-only ./scripts/scan-mkv-subtitles.ts --folder <path> --syncable-only
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { MkvExtractor } from "../src/sync/mkvExtractor";
import type { LoggerInterface } from "../src/logger";
import { isExist } from "../src/fileUtils";

const MKVTOOLNIX_DIR = path.join(__dirname, "..", "resources", "mkvtoolnix");
const REFERENCE_LANGUAGES = ["fr", "en"];
/** mkvmerge spawns a process per file; keep a lid on it for large libraries. */
const CONCURRENCY = 8;

const logger: LoggerInterface = {
    setLogLevel: () => {}, info: () => {}, debug: () => {}, verbose: () => {},
    warn: () => {},
    error: (msg) => console.error("[ERROR]", msg),
    getLogFileLocation: () => ""
};

const mkvExtractor = new MkvExtractor(MKVTOOLNIX_DIR, logger);

const { values } = parseArgs({
    options: {
        folder: { type: "string" },
        recursive: { type: "boolean", default: false },
        "syncable-only": { type: "boolean", default: false }
    },
    strict: true
});

if (!values.folder) {
    console.error("--folder is required");
    process.exit(1);
}

type Row = {
    filename: string;
    reference: string; // usable text reference track, or why not
    hebrewText: boolean; // embedded Hebrew text track — the download gate
    sidecars: string; // existing .srt files next to the video
};

function findMkvFiles(dir: string, recursive: boolean): string[] {
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (recursive) {
                found.push(...findMkvFiles(full, true));
            }
        }
        else if (entry.name.toLowerCase().endsWith(".mkv")) {
            found.push(full);
        }
    }
    return found;
}

async function inspect(fullPath: string, root: string): Promise<Row> {
    const dir = path.dirname(fullPath);
    const nameNoExt = path.parse(fullPath).name;

    let reference: string;
    try {
        const search = await mkvExtractor.findSubtitleTrack(fullPath, REFERENCE_LANGUAGES);
        if (search.track) {
            reference = `YES  ${search.track.language} (${search.track.codec})`;
        }
        else if (search.bitmapOnlyLanguages.length > 0) {
            reference = `no   ${search.bitmapOnlyLanguages.join("/")} bitmap only`;
        }
        else {
            reference = "no   none";
        }
    }
    catch (e) {
        reference = `err  ${(e as Error).message.slice(0, 30)}`;
    }

    const hebrewText = await mkvExtractor.hasSubtitleTrack(fullPath, ["he"]).catch(() => false);

    const suffixes = ["heb", "he", "Hebrew", "en", "eng", "fr", "fra"];
    const present: string[] = [];
    for (const suffix of suffixes) {
        if (await isExist(path.join(dir, `${nameNoExt}.${suffix}.srt`))) {
            present.push(suffix);
        }
    }

    return {
        filename: path.relative(root, fullPath),
        reference,
        hebrewText,
        sidecars: present.length > 0 ? present.join(",") : "-"
    };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (;;) {
            const i = next++;
            if (i >= items.length) {
                return;
            }
            results[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return results;
}

function printTable(rows: Row[]): void {
    const headers = ["file", "text reference for sync", "heb text", "sidecars"];
    const data = rows.map((r) => [r.filename, r.reference, r.hebrewText ? "yes" : "-", r.sidecars]);
    const widths = headers.map((h, i) => Math.max(h.length, ...data.map((row) => row[i].length)));

    const pad = (s: string, w: number) => s + " ".repeat(w - s.length);
    const row = (cells: string[]) => "│" + cells.map((c, i) => ` ${pad(c, widths[i])} `).join("│") + "│";
    const line = (l: string, m: string, r: string) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;

    console.log(line("┌", "┬", "┐"));
    console.log(row(headers));
    console.log(line("├", "┼", "┤"));
    for (const r of data) {
        console.log(row(r));
    }
    console.log(line("└", "┴", "┘"));
}

async function main(): Promise<void> {
    const folder = values.folder!;
    const files = findMkvFiles(folder, values.recursive!);

    if (files.length === 0) {
        console.log("No MKV files found.");
        return;
    }

    console.log(`Scanning ${files.length} MKV file(s)...\n`);
    let rows = await mapLimit(files, CONCURRENCY, (f) => inspect(f, folder));

    const syncable = rows.filter((r) => r.reference.startsWith("YES")).length;
    if (values["syncable-only"]) {
        rows = rows.filter((r) => r.reference.startsWith("YES"));
    }

    if (rows.length > 0) {
        printTable(rows);
    }
    console.log(`\n${syncable} of ${files.length} file(s) have a usable text reference track.`);
    if (syncable === 0) {
        console.log("Tip: WEB-DL and HDTV releases usually carry text subtitles; BluRay/Remux almost always carry PGS.");
    }
}

main().catch((err) => {
    console.error("[ERROR]", err.message);
    process.exit(1);
});
