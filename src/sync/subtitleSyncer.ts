import * as fs from "fs";
import * as path from "path";
import type { SyncConfig } from "~src/sync/types";
import type { OllamaClientInterface } from "~src/sync/ollamaClient";
import type { EnglishSourceFinderInterface } from "~src/sync/englishSourceFinder";
import { syncPreflightCheck } from "~src/sync/syncPreflightCheck";
import { parseSrt } from "~src/sync/subtitleParser";
import { writeSrt } from "~src/sync/subtitleWriter";
import { SubtitleMatcher } from "~src/sync/subtitleMatcher";
import { detectChunks } from "~src/sync/sceneDetector";
import { applyTimingCorrections } from "~src/sync/timingCorrector";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import { NotificationType } from "~src/notifier";

export class SubtitleSyncer {
    constructor(
        private readonly config: SyncConfig,
        private readonly subtitleSuffix: string,
        private readonly ollamaClient: OllamaClientInterface,
        private readonly englishSourceFinder: EnglishSourceFinderInterface,
        private readonly logger: LoggerInterface,
        private readonly notifier: NotifierInterface
    ) {}

    async sync(videoPath: string): Promise<void> {
        const ok = await syncPreflightCheck(this.config, this.ollamaClient, this.logger);
        if (!ok) return;

        const engSrtPath = await this.englishSourceFinder.findEnglishSrt(videoPath);
        if (!engSrtPath) return;

        const dir = path.dirname(videoPath);
        const nameNoExt = path.parse(videoPath).name;
        const hebSrtPath = path.join(dir, `${nameNoExt}.${this.subtitleSuffix}`);

        let engContent: string;
        let hebContent: string;
        try {
            engContent = fs.readFileSync(engSrtPath, "utf-8");
            hebContent = fs.readFileSync(hebSrtPath, "utf-8");
        }
        catch (e) {
            this.logger.warn(`Sync: Failed to read SRT files: ${e instanceof Error ? e.message : String(e)}. Skipping sync.`);
            return;
        }

        const engEntries = parseSrt(engContent);
        const hebEntries = parseSrt(hebContent);

        if (engEntries.length === 0 || hebEntries.length === 0) {
            this.logger.warn(`Sync: Empty SRT file(s) — eng=${engEntries.length} heb=${hebEntries.length}. Skipping sync.`);
            return;
        }

        this.logger.info(`Sync: Matching ${hebEntries.length} Hebrew lines against ${engEntries.length} English lines`);

        const matcher = new SubtitleMatcher(
            this.ollamaClient,
            this.config.ollamaModel,
            this.config.syncBatchSize,
            this.logger
        );
        const matches = await matcher.match(hebEntries, engEntries);

        if (matches.length === 0) {
            this.logger.warn("Sync: No matches produced by LLM. Skipping sync.");
            return;
        }

        const chunks = detectChunks(matches, this.config.syncChunkThresholdSeconds * 1000);
        this.logger.info(`Sync: Detected ${chunks.length} scene chunk(s)`);

        const corrected = applyTimingCorrections(hebEntries, engEntries, matches, chunks, this.logger);

        const bakPath = `${hebSrtPath}.bak`;
        try {
            fs.copyFileSync(hebSrtPath, bakPath);
            this.logger.warn(`Sync: Backed up original subtitle to ${bakPath}`);
        }
        catch (e) {
            this.logger.warn(`Sync: Could not back up ${hebSrtPath}: ${e instanceof Error ? e.message : String(e)}`);
        }

        fs.writeFileSync(hebSrtPath, writeSrt(corrected), "utf-8");
        this.logger.info(`Sync: Saved corrected subtitle to ${hebSrtPath}`);
        this.notifier.notif("Subtitle sync complete", NotificationType.DOWNLOAD);
    }
}
