import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { LoggerInterface } from "~src/logger";
import { isLanguage } from "~src/languages";
import { errorText } from "~src/stringUtils";

const execFileAsync = promisify(execFile);

/**
 * mkvmerge -J output grows with the track, chapter and attachment count, and the default
 * maxBuffer is 1 MB. A heavily-tracked remux can exceed it, and the failure surfaces as an
 * opaque "stdout maxBuffer exceeded" rather than anything actionable.
 */
const MKVMERGE_MAX_BUFFER = 32 * 1024 * 1024;

interface MkvTrack {
    id: number;
    type: string;
    codec: string;
    properties: {
        codec_id?: string;
        language?: string;
        language_ietf?: string;
    };
}

/** Codecs that mkvextract can produce as readable text. Bitmap tracks need OCR and are out of scope. */
const TEXT_CODECS = ["S_TEXT/UTF8", "S_TEXT/ASS", "S_TEXT/SSA"];

/**
 * Codecs mkvextract emits in a form parseSrt can read.
 *
 * ASS and SSA are text, but mkvextract writes them in their NATIVE format regardless of the
 * output filename, so extracting one to a .srt path produces a file the parser reads as zero
 * entries. They still count as "subtitles exist" for the download gate; they just cannot serve
 * as a sync reference.
 */
const PARSEABLE_CODECS = ["S_TEXT/UTF8"];

export interface SubtitleTrack {
    trackId: number;
    codec: string;
    language: string;
}

export interface SubtitleTrackSearch {
    /** First text track matching any of `languages`, in the order given. Null if none. */
    track: SubtitleTrack | null;
    /**
     * Languages that are present in the file but only as image-based tracks (PGS, VobSub).
     * Reported so the caller can say "found, but unusable" instead of "not found" — a
     * Blu-ray remux typically carries every language as PGS and nothing as text.
     */
    bitmapOnlyLanguages: string[];
    /**
     * Languages present as text, but in a format the parser cannot read (ASS, SSA). Kept
     * separate from bitmapOnlyLanguages so the user is told the real reason.
     */
    unsupportedLanguages: string[];
}

export interface MkvExtractorInterface {
    /**
     * Every subtitle track in the file, from a single mkvmerge spawn.
     *
     * Use this when you need to answer more than one question about the same file —
     * `findSubtitleTrack` and `hasSubtitleTrack` each spawn mkvmerge, so calling both is
     * two subprocesses and two parses of identical JSON.
     */
    listSubtitleTracks: (mkvPath: string) => Promise<SubtitleTrackInfo[]>;
    findSubtitleTrack: (mkvPath: string, languages: string[]) => Promise<SubtitleTrackSearch>;
    hasSubtitleTrack: (mkvPath: string, languages: string[]) => Promise<boolean>;
    extractSubtitle: (mkvPath: string, trackId: number, outPath: string) => Promise<void>;
}

export interface SubtitleTrackInfo {
    trackId: number;
    codec: string;
    /** As tagged in the file; compare with `isLanguage`, not with `===`. */
    language: string;
    /** Any text-based codec. Enough to answer "does a readable subtitle already exist". */
    isText: boolean;
    /** Readable by parseSrt after extraction. Required for a sync reference. */
    isParseable: boolean;
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

    async listSubtitleTracks(mkvPath: string): Promise<SubtitleTrackInfo[]> {
        this.logger.debug(`Sync: Identifying tracks in ${mkvPath}`);
        // execFile, not exec: no shell means no cmd.exe %VAR% expansion inside a quoted path,
        // and no quoting rules to get wrong.
        const { stdout } = await execFileAsync(this.mkvMergePath, ["-J", mkvPath], { maxBuffer: MKVMERGE_MAX_BUFFER });
        const tracks = (JSON.parse(stdout) as { tracks: MkvTrack[] }).tracks ?? [];
        const subtitles = tracks
            .filter((t) => t.type === "subtitles")
            .map((t) => ({
                trackId: t.id,
                codec: t.codec,
                language: t.properties?.language ?? t.properties?.language_ietf?.split("-")[0] ?? "",
                isText: TEXT_CODECS.includes(t.properties?.codec_id ?? ""),
                isParseable: PARSEABLE_CODECS.includes(t.properties?.codec_id ?? "")
            }));

        // Log the whole inventory: when nothing usable turns up, the log should answer why
        // without anyone having to re-run mkvmerge by hand.
        this.logger.debug(
            `Sync: ${subtitles.length} subtitle track(s): ` +
            subtitles.map((t) => `id=${t.trackId} codec=${t.codec} lang=${t.language || "?"} text=${t.isText}`).join(", ")
        );
        return subtitles;
    }

    async findSubtitleTrack(mkvPath: string, languages: string[]): Promise<SubtitleTrackSearch> {
        return selectSubtitleTrack(await this.listSubtitleTracks(mkvPath), languages, this.logger);
    }

    /**
     * Existence check for the download gate. Accepts ANY text codec, including ASS and SSA:
     * the question is whether the user already has readable subtitles, not whether we could
     * use the track as a sync reference.
     */
    async hasSubtitleTrack(mkvPath: string, languages: string[]): Promise<boolean> {
        try {
            const subtitles = await this.listSubtitleTracks(mkvPath);
            return subtitles.some((t) => t.isText && languages.some((l) => isLanguage(t.language, l)));
        }
        catch (e) {
            this.logger.warn(`Sync: Could not inspect MKV tracks for ${mkvPath}: ${errorText(e)}`);
            return false;
        }
    }

    async extractSubtitle(mkvPath: string, trackId: number, outPath: string): Promise<void> {
        this.logger.debug(`Sync: Extracting track ${trackId} from ${mkvPath} to ${outPath}`);
        const { stderr } = await execFileAsync(this.mkvExtractPath, [mkvPath, "tracks", `${trackId}:${outPath}`]);
        if (stderr?.trim()) {
            this.logger.debug(`Sync: mkvextract stderr: ${stderr.trim()}`);
        }
    }
}

/**
 * Pick the best text track for `languages`, in priority order, from an already-listed set.
 *
 * Language priority beats track order: a French track later in the file still beats an
 * English one earlier in it. Exported so a caller holding one listing can answer several
 * language questions without spawning mkvmerge again.
 */
export function selectSubtitleTrack(
    subtitles: SubtitleTrackInfo[],
    languages: string[],
    logger?: LoggerInterface
): SubtitleTrackSearch {
    for (const language of languages) {
        // Only a parseable track can serve as a reference. Extracting an ASS track to a .srt
        // path would silently yield a file with zero entries.
        const track = subtitles.find((t) => t.isParseable && isLanguage(t.language, language));
        if (track) {
            logger?.debug(`Sync: Found ${language} subtitle track id=${track.trackId} codec=${track.codec}`);
            return { track: { trackId: track.trackId, codec: track.codec, language }, bitmapOnlyLanguages: [], unsupportedLanguages: [] };
        }
    }

    const bitmapOnlyLanguages = languages.filter((language) =>
        subtitles.some((t) => !t.isText && isLanguage(t.language, language))
    );
    const unsupportedLanguages = languages.filter((language) =>
        subtitles.some((t) => t.isText && !t.isParseable && isLanguage(t.language, language))
    );
    if (bitmapOnlyLanguages.length > 0) {
        logger?.debug(`Sync: ${bitmapOnlyLanguages.join("/")} present only as image-based track(s)`);
    }
    if (unsupportedLanguages.length > 0) {
        logger?.debug(`Sync: ${unsupportedLanguages.join("/")} present only as ASS/SSA track(s)`);
    }
    return { track: null, bitmapOnlyLanguages, unsupportedLanguages };
}
