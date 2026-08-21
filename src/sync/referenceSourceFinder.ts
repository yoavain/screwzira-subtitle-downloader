/**
 * Finds the reference subtitle to sync a target `.srt` against.
 *
 * Flow B is entered by right-clicking the subtitle, so the target is given. The reference
 * has to be found from it, which is what this module does.
 *
 * French is preferred over English: French marks grammatical gender like Hebrew, so a
 * French line disambiguates which Hebrew line it belongs to more often than an English one
 * does. The priority list is configurable and applies to both embedded tracks and sidecars.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { LoggerInterface } from "~src/logger";
import type { MkvExtractorInterface } from "~src/sync/mkvExtractor";
import { isExist, readDir } from "~src/fileUtils";

export interface ReferenceSource {
    srtPath: string;
    language: string;
    origin: "embedded" | "sidecar";
    /**
     * True when this file was created by us and must be removed once sync finishes.
     *
     * Extracted references go to a temp folder rather than next to the video: media servers
     * (Plex, Jellyfin, Emby) scan for sidecar .srt files, and an extracted French track
     * would show up as a selectable subtitle for anyone watching. A never-created file
     * cannot be picked up, and cannot be left behind if the run dies.
     */
    temporary?: boolean;
}

export interface ReferenceLookup {
    source: ReferenceSource | null;
    /**
     * Why nothing was found, when the answer is more useful than "nothing was found".
     * A Blu-ray remux usually carries every language as PGS and none as text, so
     * "no reference" would be actively misleading there.
     */
    reason?: string;
}

export interface ReferenceSourceFinderInterface {
    find: (targetSrtPath: string) => Promise<ReferenceLookup>;
}

/** Trailing dot-segments that name a language or a variant rather than part of the title. */
const STRIPPABLE_TAGS = ["he", "heb", "iw", "hebrew", "forced", "sdh", "hi", "cc"];

/** Sidecar spellings tried per language, in order. */
const SIDECAR_SUFFIXES: Record<string, string[]> = {
    fr: ["fr", "fra", "fre", "french"],
    en: ["en", "eng", "english"]
};

const VIDEO_EXTENSIONS = [".mkv", ".mp4", ".avi"];
const SUBS_FOLDER_NAMES = ["subs", "subtitles"];

export class ReferenceSourceFinder implements ReferenceSourceFinderInterface {
    constructor(
        private readonly languages: string[],
        private readonly extraStrippableTags: string[],
        private readonly mkvExtractor: MkvExtractorInterface,
        private readonly logger: LoggerInterface
    ) {}

    async find(targetSrtPath: string): Promise<ReferenceLookup> {
        const dir = path.dirname(targetSrtPath);
        const stem = deriveStem(path.parse(targetSrtPath).name, [...STRIPPABLE_TAGS, ...this.extraStrippableTags]);
        // Scene releases put the video one level up from a Subs/ folder.
        const searchDirs = SUBS_FOLDER_NAMES.includes(path.basename(dir).toLowerCase())
            ? [dir, path.dirname(dir)]
            : [dir];

        this.logger.verbose(`Sync: Target "${path.basename(targetSrtPath)}" -> stem "${stem}"`);

        const video = await this.findVideo(stem, searchDirs);

        // Embedded first: an embedded track is guaranteed to be timed against this very
        // video file, whereas a sidecar may have been downloaded for a different release.
        let bitmapOnlyLanguages: string[] = [];
        if (video && path.extname(video).toLowerCase() === ".mkv") {
            const embedded = await this.extractEmbedded(video, stem, targetSrtPath);
            if (embedded.source) {
                return embedded;
            }
            bitmapOnlyLanguages = embedded.bitmapOnlyLanguages;
        }

        const sidecar = await this.findSidecar(stem, searchDirs, targetSrtPath);
        if (sidecar) {
            return { source: sidecar };
        }

        if (bitmapOnlyLanguages.length > 0) {
            const languages = bitmapOnlyLanguages.map((l) => l.toUpperCase()).join(" and ");
            const suggestion = bitmapOnlyLanguages.map((l) => `.${l}.srt`).join(" or ");
            this.logger.warn(
                `Sync: ${languages} subtitles exist in the MKV but are image-based (PGS/VobSub) and cannot be read as text. ` +
                `Place a ${bitmapOnlyLanguages.map((l) => `${stem}.${l}.srt`).join(" or ")} next to the video, or run OCR on the track.`
            );
            return {
                source: null,
                reason: `${languages} subtitles in the video are image-based (Blu-ray PGS) and cannot be used. `
                    + `Add a ${suggestion} file next to the video.`
            };
        }

        return { source: null };
    }

    private async findVideo(stem: string, dirs: string[]): Promise<string | null> {
        for (const dir of dirs) {
            for (const ext of VIDEO_EXTENSIONS) {
                const candidate = path.join(dir, `${stem}${ext}`);
                if (await isExist(candidate)) {
                    return candidate;
                }
            }
        }

        // Nothing matched the stem. A folder holding exactly one video is unambiguous anyway.
        for (const dir of dirs) {
            const videos = await this.videosIn(dir);
            if (videos.length === 1) {
                this.logger.verbose(`Sync: No stem match; using the only video in ${dir}`);
                return videos[0];
            }
        }

        this.logger.verbose(`Sync: No video file found for stem "${stem}" — sidecar references only`);
        return null;
    }

    private async videosIn(dir: string): Promise<string[]> {
        try {
            const items = await readDir(dir);
            return items
                .filter((item) => VIDEO_EXTENSIONS.includes(path.extname(item).toLowerCase()))
                .map((item) => path.join(dir, item));
        }
        catch {
            return [];
        }
    }

    private async extractEmbedded(
        video: string,
        stem: string,
        targetSrtPath: string
    ): Promise<{ source: ReferenceSource | null; bitmapOnlyLanguages: string[] }> {
        const none = { source: null, bitmapOnlyLanguages: [] as string[] };

        let search: Awaited<ReturnType<MkvExtractorInterface["findSubtitleTrack"]>>;
        try {
            search = await this.mkvExtractor.findSubtitleTrack(video, this.languages);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvmerge failed on ${video}: ${errorText(e)}. Falling back to sidecar lookup.`);
            return none;
        }

        const track = search.track;
        if (!track) {
            return { source: null, bitmapOnlyLanguages: search.bitmapOnlyLanguages };
        }

        // A sidecar left by an older build, next to the video. Reuse it rather than paying
        // for extraction again, but do not adopt the clicked file as its own reference.
        const sidecarPath = path.join(path.dirname(video), `${stem}.${track.language}.srt`);
        if (!samePath(sidecarPath, targetSrtPath) && await isExist(sidecarPath)) {
            this.logger.verbose(`Sync: Reusing previously extracted ${track.language} reference at ${sidecarPath}`);
            return { source: { srtPath: sidecarPath, language: track.language, origin: "embedded" }, bitmapOnlyLanguages: [] };
        }

        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-sync-"));
        const outPath = path.join(tempDir, `${stem}.${track.language}.srt`);

        try {
            this.logger.info(`Sync: Extracting ${track.language} subtitle track from the video (this can take a minute on a large file)`);
            await this.mkvExtractor.extractSubtitle(video, track.trackId, outPath);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvextract failed: ${errorText(e)}. Falling back to sidecar lookup.`);
            fs.rmSync(tempDir, { recursive: true, force: true });
            return none;
        }

        this.logger.info(`Sync: Extracted ${track.language} reference from ${path.basename(video)}`);
        return {
            source: { srtPath: outPath, language: track.language, origin: "embedded", temporary: true },
            bitmapOnlyLanguages: []
        };
    }

    private async findSidecar(stem: string, dirs: string[], targetSrtPath: string): Promise<ReferenceSource | null> {
        for (const language of this.languages) {
            for (const suffix of SIDECAR_SUFFIXES[language] ?? [language]) {
                for (const dir of dirs) {
                    const candidate = path.join(dir, `${stem}.${suffix}.srt`);
                    // Never let the file the user clicked become its own reference.
                    if (samePath(candidate, targetSrtPath)) {
                        continue;
                    }
                    if (await isExist(candidate)) {
                        this.logger.info(`Sync: Using ${language} sidecar reference ${path.basename(candidate)}`);
                        return { srtPath: candidate, language, origin: "sidecar" };
                    }
                }
            }
        }
        return null;
    }
}

/**
 * Strip one trailing dot-segment when it names a language or variant.
 *
 *   Movie.Hebrew.srt                      -> "Movie"
 *   The.Office.S01E01.720p-CtrlHD.heb.srt -> "The.Office.S01E01.720p-CtrlHD"
 *   Movie.2021.1080p.srt                  -> "Movie.2021.1080p"   (nothing stripped)
 */
export function deriveStem(basenameNoExt: string, strippableTags: string[]): string {
    const lastDot = basenameNoExt.lastIndexOf(".");
    if (lastDot <= 0) {
        return basenameNoExt;
    }
    const tag = basenameNoExt.slice(lastDot + 1).toLowerCase();
    return strippableTags.includes(tag) ? basenameNoExt.slice(0, lastDot) : basenameNoExt;
}

function samePath(a: string, b: string): boolean {
    return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}
