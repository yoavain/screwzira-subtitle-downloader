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

import * as path from "node:path";
import type { LoggerInterface } from "~src/logger";
import type { MkvExtractorInterface } from "~src/sync/mkvExtractor";
import { isExist, readDir } from "~src/fileUtils";

export interface ReferenceSource {
    srtPath: string;
    language: string;
    origin: "embedded" | "sidecar";
}

export interface ReferenceSourceFinderInterface {
    find: (targetSrtPath: string) => Promise<ReferenceSource | null>;
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

    async find(targetSrtPath: string): Promise<ReferenceSource | null> {
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
        if (video && path.extname(video).toLowerCase() === ".mkv") {
            const embedded = await this.extractEmbedded(video, stem, targetSrtPath);
            if (embedded) {
                return embedded;
            }
        }

        return this.findSidecar(stem, searchDirs, targetSrtPath);
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

    private async extractEmbedded(video: string, stem: string, targetSrtPath: string): Promise<ReferenceSource | null> {
        let track: Awaited<ReturnType<MkvExtractorInterface["findSubtitleTrack"]>>;
        try {
            track = await this.mkvExtractor.findSubtitleTrack(video, this.languages);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvmerge failed on ${video}: ${errorText(e)}. Falling back to sidecar lookup.`);
            return null;
        }
        if (!track) {
            return null;
        }

        const outPath = path.join(path.dirname(video), `${stem}.${track.language}.srt`);
        if (samePath(outPath, targetSrtPath)) {
            return null;
        }
        // A previous run already extracted this track.
        if (await isExist(outPath)) {
            this.logger.verbose(`Sync: Reusing previously extracted ${track.language} reference at ${outPath}`);
            return { srtPath: outPath, language: track.language, origin: "embedded" };
        }

        try {
            await this.mkvExtractor.extractSubtitle(video, track.trackId, outPath);
        }
        catch (e) {
            this.logger.warn(`Sync: mkvextract failed: ${errorText(e)}. Falling back to sidecar lookup.`);
            return null;
        }

        this.logger.info(`Sync: Extracted ${track.language} reference from ${path.basename(video)}`);
        return { srtPath: outPath, language: track.language, origin: "embedded" };
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
