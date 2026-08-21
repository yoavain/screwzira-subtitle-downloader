import * as path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { LoggerInterface } from "~src/logger";

const execAsync = promisify(exec);

interface MkvTrack {
    id: number;
    type: string;
    codec: string;
    properties: {
        codec_id?: string;
        language?: string;
        language_ietf?: string;
        default_track?: boolean;
        track_name?: string;
    };
}

/** Codecs that mkvextract can produce as readable text. Bitmap tracks need OCR and are out of scope. */
const TEXT_CODECS = ["S_TEXT/UTF8", "S_TEXT/ASS", "S_TEXT/SSA"];

export interface SubtitleTrack {
    trackId: number;
    codec: string;
    language: string;
}

export interface MkvExtractorInterface {
    /** First text subtitle track matching any of `languages`, in the order given. Null if none. */
    findSubtitleTrack: (mkvPath: string, languages: string[]) => Promise<SubtitleTrack | null>;
    hasSubtitleTrack: (mkvPath: string, languages: string[]) => Promise<boolean>;
    extractSubtitle: (mkvPath: string, trackId: number, outPath: string) => Promise<void>;
}

export class MkvExtractor implements MkvExtractorInterface {
    private readonly mkvMergePath: string;
    private readonly mkvExtractPath: string;

    constructor(
        mkvtoolnixDir: string,
        private readonly logger: LoggerInterface
    ) {
        this.mkvMergePath = path.join(mkvtoolnixDir, "mkvmerge.exe");
        this.mkvExtractPath = path.join(mkvtoolnixDir, "mkvextract.exe");
    }

    async findSubtitleTrack(mkvPath: string, languages: string[]): Promise<SubtitleTrack | null> {
        this.logger.debug(`Sync: Identifying tracks in ${mkvPath}`);
        const { stdout } = await execAsync(`"${this.mkvMergePath}" -J "${mkvPath}"`);
        const tracks = (JSON.parse(stdout) as { tracks: MkvTrack[] }).tracks ?? [];

        // Language priority wins over track order: a French track later in the file still
        // beats an English track earlier in it.
        for (const language of languages) {
            const track = tracks.find((t) => isTextSubtitle(t) && matchesLanguage(t, language));
            if (track) {
                this.logger.debug(`Sync: Found ${language} subtitle track id=${track.id} codec=${track.codec}`);
                return { trackId: track.id, codec: track.codec, language };
            }
        }
        return null;
    }

    async hasSubtitleTrack(mkvPath: string, languages: string[]): Promise<boolean> {
        try {
            return (await this.findSubtitleTrack(mkvPath, languages)) !== null;
        }
        catch (e) {
            this.logger.warn(`Sync: Could not inspect MKV tracks for ${mkvPath}: ${(e as Error).message}`);
            return false;
        }
    }

    async extractSubtitle(mkvPath: string, trackId: number, outPath: string): Promise<void> {
        this.logger.debug(`Sync: Extracting track ${trackId} from ${mkvPath} to ${outPath}`);
        await execAsync(`"${this.mkvExtractPath}" "${mkvPath}" tracks ${trackId}:"${outPath}"`);
    }
}

function isTextSubtitle(track: MkvTrack): boolean {
    return track.type === "subtitles" && TEXT_CODECS.includes(track.properties?.codec_id ?? "");
}

/**
 * Matches ISO 639-2/B, 639-2/T and BCP 47 spellings of the same language, so "fr" also
 * matches a track tagged "fre" or "fra", and "he" also matches "heb" or "iw".
 */
function matchesLanguage(track: MkvTrack, language: string): boolean {
    const aliases = LANGUAGE_ALIASES[language.toLowerCase()] ?? [language.toLowerCase()];
    const declared = (track.properties?.language ?? "").toLowerCase();
    const ietf = (track.properties?.language_ietf ?? "").toLowerCase().split("-")[0];
    return aliases.includes(declared) || aliases.includes(ietf);
}

const LANGUAGE_ALIASES: Record<string, string[]> = {
    fr: ["fr", "fre", "fra", "french"],
    fre: ["fr", "fre", "fra", "french"],
    fra: ["fr", "fre", "fra", "french"],
    en: ["en", "eng", "english"],
    eng: ["en", "eng", "english"],
    he: ["he", "heb", "iw", "hebrew"],
    heb: ["he", "heb", "iw", "hebrew"]
};
