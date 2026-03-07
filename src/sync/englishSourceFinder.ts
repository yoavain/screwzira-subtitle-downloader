import * as path from "node:path";
import type { LoggerInterface } from "~src/logger";
import type { MkvExtractorInterface } from "~src/sync/mkvExtractor";
import { isExist } from "~src/fileUtils";


export interface EnglishSourceFinderInterface {
    findEnglishSrt: (videoPath: string) => Promise<string | null>;
}

export class EnglishSourceFinder implements EnglishSourceFinderInterface {
    constructor(
        private readonly mkvExtractor: MkvExtractorInterface,
        private readonly logger: LoggerInterface
    ) {}

    async findEnglishSrt(videoPath: string): Promise<string | null> {
        const dir = path.dirname(videoPath);
        const nameNoExt = path.parse(videoPath).name;
        const engSrtPath = path.join(dir, `${nameNoExt}.eng.srt`);

        if (await isExist(engSrtPath)) {
            this.logger.verbose(`Sync: Found existing English SRT at ${engSrtPath}`);
            return engSrtPath;
        }

        const ext = path.extname(videoPath).toLowerCase();
        if (ext !== ".mkv") {
            this.logger.warn(`Sync: No English source found for non-MKV file ${videoPath}. Skipping sync.`);
            return null;
        }

        let track: { trackId: number; codec: string } | null;
        try {
            track = await this.mkvExtractor.findEnglishSubtitleTrack(videoPath);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvmerge failed on ${videoPath}: ${e instanceof Error ? e.message : String(e)}. Skipping sync.`);
            return null;
        }

        if (!track) {
            this.logger.warn(`Sync: No extractable English subtitle track in MKV ${videoPath} (PGS/bitmap tracks skipped). Skipping sync.`);
            return null;
        }

        try {
            await this.mkvExtractor.extractSubtitle(videoPath, track.trackId, engSrtPath);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvextract failed: ${e instanceof Error ? e.message : String(e)}. Skipping sync.`);
            return null;
        }

        this.logger.verbose(`Sync: Extracted English SRT to ${engSrtPath}`);
        return engSrtPath;
    }
}
