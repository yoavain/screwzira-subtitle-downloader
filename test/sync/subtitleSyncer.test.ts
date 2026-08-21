import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SubtitleSyncer } from "~src/sync/subtitleSyncer";
import { GateFailure } from "~src/sync/syncGates";
import type { ReferenceSourceFinderInterface, ReferenceSource } from "~src/sync/referenceSourceFinder";
import { parseSrt } from "~src/sync/subtitleParser";
import { writeSrt } from "~src/sync/subtitleWriter";
import type { SubtitleEntry } from "~src/sync/types";
import { MockLogger, MockNotifier } from "~test/mocks";
import { NotificationType } from "~src/notifier";

const logger = new MockLogger();

function makeNotifier() {
    return new MockNotifier();
}

function finderReturning(source: ReferenceSource | null): ReferenceSourceFinderInterface {
    return { find: jest.fn().mockResolvedValue({ source }) };
}

/** Evenly spaced dialogue, so the timing fingerprint is unambiguous. */
function makeEntries(count: number, offsetMs = 0): SubtitleEntry[] {
    return Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        start: 1000 + i * 4000 + offsetMs,
        end: 3000 + i * 4000 + offsetMs,
        text: `line ${i + 1}`
    }));
}

let tmpDir: string;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "syncer-"));
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

function write(name: string, entries: SubtitleEntry[]): string {
    const full = path.join(tmpDir, name);
    fs.writeFileSync(full, writeSrt(entries), "utf-8");
    return full;
}

describe("SubtitleSyncer — hard gates notify and stop", () => {
    it("G2: unreadable target", async () => {
        const notifier = makeNotifier();
        const syncer = new SubtitleSyncer(finderReturning(null), logger, notifier);

        const outcome = await syncer.sync(path.join(tmpDir, "missing.srt"));

        expect(outcome.ok).toBe(false);
        expect(outcome.failure).toBe(GateFailure.TARGET_UNREADABLE);
        expect(notifier.notif).toHaveBeenCalledWith(expect.any(String), NotificationType.FAILED);
    });

    it("G2: empty target", async () => {
        const notifier = makeNotifier();
        const target = path.join(tmpDir, "empty.srt");
        fs.writeFileSync(target, "");

        const outcome = await new SubtitleSyncer(finderReturning(null), logger, notifier).sync(target);

        expect(outcome.failure).toBe(GateFailure.TARGET_EMPTY);
    });

    it("G3: no reference found", async () => {
        const notifier = makeNotifier();
        const target = write("Movie.Hebrew.srt", makeEntries(10));

        const outcome = await new SubtitleSyncer(finderReturning(null), logger, notifier).sync(target);

        expect(outcome.failure).toBe(GateFailure.NO_REFERENCE);
        expect(notifier.notif).toHaveBeenCalledWith(expect.stringContaining("reference"), NotificationType.FAILED);
    });

    it("G3: reference exists but is empty", async () => {
        const notifier = makeNotifier();
        const target = write("Movie.Hebrew.srt", makeEntries(10));
        const refPath = path.join(tmpDir, "Movie.fr.srt");
        fs.writeFileSync(refPath, "");

        const outcome = await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            notifier
        ).sync(target);

        expect(outcome.failure).toBe(GateFailure.REFERENCE_EMPTY);
    });

    it("leaves the target untouched when a gate fails", async () => {
        const entries = makeEntries(10);
        const target = write("Movie.Hebrew.srt", entries);
        const before = fs.readFileSync(target, "utf-8");

        await new SubtitleSyncer(finderReturning(null), logger, makeNotifier()).sync(target);

        expect(fs.readFileSync(target, "utf-8")).toBe(before);
        expect(fs.existsSync(`${target}.bak`)).toBe(false);
    });
});

describe("SubtitleSyncer — successful sync", () => {
    const setup = () => {
        const reference = makeEntries(40);
        const target = write("Movie.Hebrew.srt", makeEntries(40, 2500));
        const refPath = write("Movie.fr.srt", reference);
        return { reference, target, refPath };
    };

    it("re-times the target onto the reference and reports success", async () => {
        const { target, refPath, reference } = setup();
        const notifier = makeNotifier();

        const outcome = await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            notifier
        ).sync(target);

        expect(outcome.ok).toBe(true);
        const corrected = parseSrt(fs.readFileSync(target, "utf-8"));
        expect(Math.abs(corrected[0].start - reference[0].start)).toBeLessThan(150);
        expect(notifier.notif).toHaveBeenCalledWith(expect.stringContaining("synced"), NotificationType.DOWNLOAD);
    });

    it("writes a .bak of the original before overwriting", async () => {
        const { target, refPath } = setup();
        const before = fs.readFileSync(target, "utf-8");

        await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            makeNotifier()
        ).sync(target);

        expect(fs.readFileSync(`${target}.bak`, "utf-8")).toBe(before);
    });

    it("preserves text, order and entry count", async () => {
        const { target, refPath } = setup();
        const original = parseSrt(fs.readFileSync(target, "utf-8"));

        await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            makeNotifier()
        ).sync(target);

        const corrected = parseSrt(fs.readFileSync(target, "utf-8"));
        expect(corrected).toHaveLength(original.length);
        expect(corrected.map((e) => e.text)).toEqual(original.map((e) => e.text));
    });

    it("deletes an extracted reference when it is done", async () => {
        // Extracted references live in a temp folder so media servers never index them,
        // and they must not survive the run.
        const { target } = setup();
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-sync-"));
        const tempRef = path.join(tempDir, "Movie.fr.srt");
        fs.writeFileSync(tempRef, writeSrt(makeEntries(40)), "utf-8");

        await new SubtitleSyncer(
            finderReturning({ srtPath: tempRef, language: "fr", origin: "embedded", dispose: () => fs.rmSync(tempDir, { recursive: true, force: true }) }),
            logger,
            makeNotifier()
        ).sync(target);

        expect(fs.existsSync(tempRef)).toBe(false);
        expect(fs.existsSync(tempDir)).toBe(false);
    });

    it("never deletes a sidecar reference the user already had", async () => {
        const { target, refPath } = setup();

        await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            makeNotifier()
        ).sync(target);

        expect(fs.existsSync(refPath)).toBe(true);
    });

    it("still deletes the extracted reference when a later gate fails", async () => {
        const target = write("Movie.Hebrew.srt", makeEntries(10));
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-sync-"));
        const tempRef = path.join(tempDir, "Movie.fr.srt");
        fs.writeFileSync(tempRef, "", "utf-8"); // empty -> REFERENCE_EMPTY

        const outcome = await new SubtitleSyncer(
            finderReturning({ srtPath: tempRef, language: "fr", origin: "embedded", dispose: () => fs.rmSync(tempDir, { recursive: true, force: true }) }),
            logger,
            makeNotifier()
        ).sync(target);

        expect(outcome.failure).toBe(GateFailure.REFERENCE_EMPTY);
        expect(fs.existsSync(tempDir)).toBe(false);
    });

    it("reports the offset range, not just the first segment, when the file was cut", async () => {
        // A real run logged "0 ms, 1 cut" while the second half moved by seconds.
        const reference = makeEntries(60);
        const shifted = makeEntries(60).map((entry, i) => (i < 30 ? entry : { ...entry, start: entry.start - 5000, end: entry.end - 5000 }));
        const target = write("Movie.Hebrew.srt", shifted);
        const refPath = write("Movie.fr.srt", reference);
        const notifier = makeNotifier();

        const outcome = await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            notifier
        ).sync(target);

        expect(outcome.warp?.segments.length).toBeGreaterThan(1);
        expect(notifier.notif).toHaveBeenCalledWith(expect.stringContaining(" to "), expect.anything());
    });

    it("warns instead of claiming success when the match is weak", async () => {
        const target = write("Movie.Hebrew.srt", makeEntries(20));
        const refPath = write("Movie.fr.srt", makeEntries(20));
        const notifier = makeNotifier();

        // A confidence floor above any achievable value forces the low-quality path.
        const outcome = await new SubtitleSyncer(
            finderReturning({ srtPath: refPath, language: "fr", origin: "sidecar", dispose: () => undefined }),
            logger,
            notifier,
            { minConfidence: 1.1 }
        ).sync(target);

        expect(outcome.ok).toBe(true);
        expect(notifier.notif).toHaveBeenCalledWith(expect.stringContaining("weak"), NotificationType.WARNING);
    });
});
