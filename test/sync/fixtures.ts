/**
 * Fixture access for sync tests.
 *
 * Fixture files are INPUTS and must never be modified. The sync pipeline writes in place —
 * it overwrites the target `.srt` and drops a `.srt.bak` beside it — and the reference
 * finder extracts embedded tracks next to the video. So nothing here ever hands out a
 * fixture path for writing: callers either get parsed entries, or an isolated temp copy.
 *
 * `hashFixtures` / `expectFixturesUnchanged` back that up with an actual check, so a future
 * test that writes to the wrong path fails loudly instead of quietly editing the corpus.
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseSrt } from "~src/sync/subtitleParser";
import { isExistSync } from "~src/fileUtils";
import type { SubtitleEntry } from "~src/sync/types";

export const SYNC_RESOURCES = path.resolve(__dirname, "../resources/sync");
export const CASES_DIR = path.join(SYNC_RESOURCES, "cases");

/** Suffixes that identify each side of a fixture pair, in priority order. */
const TARGET_SUFFIXES = [".heb.srt", ".he.srt", ".hebrew.srt"];
const REFERENCE_SUFFIXES = [".fr.srt", ".fra.srt", ".fre.srt", ".en.srt", ".eng.srt"];

export interface SyncCase {
    name: string;
    targetPath: string;
    referencePath: string;
    referenceLanguage: string;
    target: SubtitleEntry[];
    reference: SubtitleEntry[];
}

export function listCaseNames(): string[] {
    if (!isExistSync(CASES_DIR)) {
        return [];
    }
    return fs
        .readdirSync(CASES_DIR, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

export function loadCase(name: string): SyncCase {
    const dir = path.join(CASES_DIR, name);
    const files = fs.readdirSync(dir);

    const targetFile = findBySuffix(files, TARGET_SUFFIXES);
    const referenceFile = findBySuffix(files, REFERENCE_SUFFIXES);
    if (!targetFile || !referenceFile) {
        throw new Error(`Fixture "${name}" needs one Hebrew and one French/English .srt (found: ${files.join(", ")})`);
    }

    const targetPath = path.join(dir, targetFile);
    const referencePath = path.join(dir, referenceFile);

    return {
        name,
        targetPath,
        referencePath,
        referenceLanguage: referenceFile.endsWith(".fr.srt") || referenceFile.endsWith(".fra.srt") || referenceFile.endsWith(".fre.srt") ? "fr" : "en",
        target: parseSrt(readUtf8(targetPath)),
        reference: parseSrt(readUtf8(referencePath))
    };
}

/**
 * Copy a case into a fresh temp directory and return the copied paths. Use this for any
 * test that runs the syncer end to end, since the syncer writes in place.
 */
export function copyCaseToTmp(name: string): { dir: string; targetPath: string; referencePath: string; cleanup: () => void } {
    const source = loadCase(name);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `synccase-${name}-`));
    const targetPath = path.join(dir, path.basename(source.targetPath));
    const referencePath = path.join(dir, path.basename(source.referencePath));

    fs.copyFileSync(source.targetPath, targetPath);
    fs.copyFileSync(source.referencePath, referencePath);

    return { dir, targetPath, referencePath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

/** SHA-256 of every file under the sync resources tree, keyed by relative path. */
export function hashFixtures(): Record<string, string> {
    const hashes: Record<string, string> = {};
    walk(SYNC_RESOURCES, (file) => {
        hashes[path.relative(SYNC_RESOURCES, file).replace(/\\/g, "/")] = crypto
            .createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex");
    });
    return hashes;
}

export function expectFixturesUnchanged(before: Record<string, string>): void {
    expect(hashFixtures()).toEqual(before);
}

function findBySuffix(files: string[], suffixes: string[]): string | undefined {
    for (const suffix of suffixes) {
        const match = files.find((file) => file.toLowerCase().endsWith(suffix));
        if (match) {
            return match;
        }
    }
    return undefined;
}

function readUtf8(file: string): string {
    // Some subtitle downloads carry a BOM; parseSrt would read it as part of the first index.
    const text = fs.readFileSync(file, "utf-8");
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function walk(dir: string, visit: (file: string) => void): void {
    if (!isExistSync(dir)) {
        return;
    }
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, visit);
        }
        else {
            visit(full);
        }
    }
}
