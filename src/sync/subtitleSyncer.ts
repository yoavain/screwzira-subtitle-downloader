/**
 * Flow B orchestrator. Right-click a .srt, and this re-times it against a reference.
 *
 * Phase 1 wires Stage 1 (timeWarp) and Stage 4 (retime). Stages 2 and 3 — the bead DP and
 * the refit — slot in between them without changing this file's shape.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType } from "~src/notifier";
import type { ReferenceSourceFinderInterface } from "~src/sync/referenceSourceFinder";
import { parseSrt } from "~src/sync/subtitleParser";
import { writeSrt } from "~src/sync/subtitleWriter";
import { timeWarp } from "~src/sync/timeWarp";
import { retime } from "~src/sync/retimer";
import type { SubtitleEntry, TimeWarp } from "~src/sync/types";
import { GateFailure } from "~src/sync/syncGates";

export interface SyncOptions {
    splitPenaltyMs?: number;
    maxOffsetMs?: number;
    minSegmentEntries?: number;
    /** Below this, the result is reported as low quality rather than applied silently. */
    minConfidence?: number;
}

const DEFAULT_MIN_CONFIDENCE = 0.25;

export interface SyncOutcome {
    ok: boolean;
    failure?: GateFailure;
    warp?: TimeWarp;
}

export class SubtitleSyncer {
    constructor(
        private readonly referenceSourceFinder: ReferenceSourceFinderInterface,
        private readonly logger: LoggerInterface,
        private readonly notifier: NotifierInterface,
        private readonly options: SyncOptions = {}
    ) {}

    async sync(targetSrtPath: string): Promise<SyncOutcome> {
        const target = this.readEntries(targetSrtPath, "target");
        if (!target) {
            return this.fail(GateFailure.TARGET_UNREADABLE, `Cannot read ${path.basename(targetSrtPath)}`);
        }
        if (target.length === 0) {
            return this.fail(GateFailure.TARGET_EMPTY, `${path.basename(targetSrtPath)} has no subtitle entries`);
        }

        const reference = await this.referenceSourceFinder.find(targetSrtPath);
        if (!reference) {
            return this.fail(GateFailure.NO_REFERENCE, "No French or English reference subtitle found");
        }

        const referenceEntries = this.readEntries(reference.srtPath, "reference");
        if (!referenceEntries || referenceEntries.length === 0) {
            return this.fail(GateFailure.REFERENCE_EMPTY, `Reference ${path.basename(reference.srtPath)} is empty or unreadable`);
        }

        this.logger.info(`Sync: Aligning ${target.length} entries against ${referenceEntries.length} ${reference.language} entries (${reference.origin})`);

        const warp = timeWarp(target, referenceEntries, this.options);
        const corrected = retime(target, warp);

        this.backup(targetSrtPath);
        fs.writeFileSync(targetSrtPath, writeSrt(corrected), "utf-8");

        this.report(targetSrtPath, warp);
        return { ok: true, warp };
    }

    private report(targetSrtPath: string, warp: TimeWarp): void {
        const shift = Math.round(warp.segments[0]?.offset ?? 0);
        const cuts = warp.segments.length - 1;
        const detail = cuts > 0 ? `${shift} ms, ${cuts} cut${cuts > 1 ? "s" : ""}` : `${shift} ms`;
        const minConfidence = this.options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;

        this.logger.info(`Sync: Saved ${path.basename(targetSrtPath)} — ${detail}, confidence ${warp.confidence.toFixed(2)}`);

        if (warp.confidence < minConfidence) {
            // Still written — the .bak makes it trivially reversible, and a weak match is
            // sometimes still an improvement. But the user must be told not to trust it.
            this.notifier.notif(`Sync finished but the match looks weak (${detail}). Check the result; the original is in the .bak file.`, NotificationType.WARNING);
            return;
        }
        this.notifier.notif(`Subtitle synced (${detail})`, NotificationType.DOWNLOAD);
    }

    private backup(targetSrtPath: string): void {
        const bakPath = `${targetSrtPath}.bak`;
        try {
            fs.copyFileSync(targetSrtPath, bakPath);
            this.logger.verbose(`Sync: Backed up original to ${path.basename(bakPath)}`);
        }
        catch (e) {
            this.logger.warn(`Sync: Could not back up ${targetSrtPath}: ${errorText(e)}`);
        }
    }

    private readEntries(srtPath: string, label: string): SubtitleEntry[] | null {
        try {
            return parseSrt(fs.readFileSync(srtPath, "utf-8"));
        }
        catch (e) {
            this.logger.warn(`Sync: Failed to read ${label} ${srtPath}: ${errorText(e)}`);
            return null;
        }
    }

    private fail(failure: GateFailure, message: string): SyncOutcome {
        this.logger.warn(`Sync: ${message}. Skipping sync.`);
        this.notifier.notif(message, NotificationType.FAILED);
        return { ok: false, failure };
    }
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
