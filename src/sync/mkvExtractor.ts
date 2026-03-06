import { exec } from "child_process";
import { promisify } from "util";
import type { LoggerInterface } from "~src/logger";

const execAsync = promisify(exec);

interface MkvTrack {
    id: number;
    type: string;
    codec: string;
    properties: {
        language?: string;
        language_ietf?: string;
        default_track?: boolean;
        track_name?: string;
    };
}

const TEXT_CODECS = ["S_TEXT/UTF8", "S_TEXT/ASS", "S_TEXT/SSA"];

export interface MkvExtractorInterface {
    findEnglishSubtitleTrack: (mkvPath: string) => Promise<{ trackId: number; codec: string } | null>;
    extractSubtitle: (mkvPath: string, trackId: number, outPath: string) => Promise<void>;
    hasHebrewSubtitleTrack: (mkvPath: string) => Promise<boolean>;
}

export class MkvExtractor implements MkvExtractorInterface {
    constructor(
        private readonly mkvMergePath: string,
        private readonly mkvExtractPath: string,
        private readonly logger: LoggerInterface
    ) {}

    async findEnglishSubtitleTrack(mkvPath: string): Promise<{ trackId: number; codec: string } | null> {
        this.logger.debug(`Sync: Identifying tracks in ${mkvPath}`);
        const { stdout } = await execAsync(`"${this.mkvMergePath}" -J "${mkvPath}"`);
        const data = JSON.parse(stdout) as { tracks: MkvTrack[] };

        const track = data.tracks.find((t) =>
            t.type === "subtitles" &&
            TEXT_CODECS.includes(t.codec) &&
            (t.properties.language === "eng" || t.properties.language_ietf?.startsWith("en"))
        );

        if (!track) return null;
        this.logger.debug(`Sync: Found English subtitle track id=${track.id} codec=${track.codec}`);
        return { trackId: track.id, codec: track.codec };
    }

    async extractSubtitle(mkvPath: string, trackId: number, outPath: string): Promise<void> {
        this.logger.debug(`Sync: Extracting track ${trackId} from ${mkvPath} → ${outPath}`);
        await execAsync(`"${this.mkvExtractPath}" "${mkvPath}" tracks ${trackId}:"${outPath}"`);
    }

    async hasHebrewSubtitleTrack(mkvPath: string): Promise<boolean> {
        try {
            this.logger.debug(`Sync: Checking for embedded Hebrew subtitle track in ${mkvPath}`);
            const { stdout } = await execAsync(`"${this.mkvMergePath}" -J "${mkvPath}"`);
            const data = JSON.parse(stdout) as { tracks: MkvTrack[] };
            return data.tracks.some((t) =>
                t.type === "subtitles" &&
                TEXT_CODECS.includes(t.codec) &&
                (t.properties.language === "heb" || t.properties.language_ietf?.startsWith("he"))
            );
        }
        catch (e) {
            this.logger.warn(`Sync: Could not inspect MKV tracks for ${mkvPath}: ${(e as Error).message}`);
            return false;
        }
    }
}
