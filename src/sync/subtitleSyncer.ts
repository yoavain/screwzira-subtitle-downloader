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
import type { ReferenceSource, ReferenceSourceFinderInterface } from "~src/sync/referenceSourceFinder";
import { parseSrt } from "~src/sync/subtitleParser";
import { writeSrt } from "~src/sync/subtitleWriter";
import { timeWarp } from "~src/sync/timeWarp";
import type { TimeWarpOptions } from "~src/sync/timeWarp";
import { retime } from "~src/sync/retimer";
import type { SubtitleEntry, TimeWarp } from "~src/sync/types";
import { GateFailure } from "~src/sync/syncGates";
import { errorText } from "~src/stringUtils";

/** Everything timeWarp accepts, plus the syncer's own reporting threshold. Extending rather
 * than re-listing keeps offsetBinMs / maxCandidateOffsets / framerateRatios reachable. */
export interface SyncOptions extends TimeWarpOptions {
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

        const lookup = await this.referenceSourceFinder.find(targetSrtPath);
        const reference = lookup.source;
        if (!reference) {
            return this.fail(GateFailure.NO_REFERENCE, lookup.reason ?? "No French or English reference subtitle found");
        }

        try {
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
        finally {
            this.release(reference);
        }
    }

    /** Hand the reference back so the finder can release anything it created. */
    private release(reference: ReferenceSource): void {
        try {
            reference.dispose();
        }
        catch (e) {
            this.logger.warn(`Sync: Could not release the reference: ${errorText(e)}`);
        }
    }

    private report(targetSrtPath: string, warp: TimeWarp): void {
        const minConfidence = this.options.minConfidence ?? DEFAULT_MIN_CONFIDENCE;
        const detail = describeShift(warp);

        // ASCII only: the log file is not written as UTF-8, so an em dash arrives as mojibake.
        this.logger.info(`Sync: Saved ${path.basename(targetSrtPath)} - ${detail}, confidence ${warp.confidence.toFixed(2)}`);

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
        // Reasons may already end in a period; do not double it up.
        this.logger.warn(`Sync: ${message.replace(/\.$/, "")}. Skipping sync.`);
        this.notifier.notif(message, NotificationType.FAILED);
        return { ok: false, failure };
    }
}


/**
 * Summarise the shift for the user.
 *
 * Reporting only the first segment's offset is misleading once the file was cut: a real run
 * logged "0 ms, 1 cut" while the second half moved by seconds. With more than one segment,
 * report the range actually applied.
 */
function describeShift(warp: TimeWarp): string {
    const offsets = warp.segments.map((segment) => Math.round(segment.offset));
    const cuts = warp.segments.length - 1;
    const scale = warp.segments[0]?.scale ?? 1;

    const shift = offsets.length > 1 && Math.min(...offsets) !== Math.max(...offsets)
        ? `${Math.min(...offsets)} to ${Math.max(...offsets)} ms`
        : `${offsets[0] ?? 0} ms`;

    const parts = [shift];
    if (cuts > 0) {
        parts.push(`${cuts} cut${cuts > 1 ? "s" : ""}`);
    }
    if (scale !== 1) {
        parts.push(`framerate x${scale.toFixed(4)}`);
    }
    return parts.join(", ");
}
