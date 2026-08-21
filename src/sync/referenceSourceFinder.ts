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
import { aliasesFor, strippableTags } from "~src/languages";
import { errorText } from "~src/stringUtils";

export interface ReferenceSource {
    srtPath: string;
    language: string;
    origin: "embedded" | "sidecar";
    /**
     * Releases anything this lookup created. Always safe to call; a no-op for a sidecar the
     * user already had.
     *
     * The consumer must never derive a path to delete from `srtPath` — only this module
     * knows whether the file sits in a scratch folder it made or in the user's media folder,
     * and the two cases are adjacent return statements in `extractEmbedded`. Handing back a
     * closure keeps that knowledge here, so a `rmSync(dirname(...), { recursive: true })` in
     * the caller can never be pointed at a media folder.
     *
     * Extraction targets a temp folder rather than the video's folder because media servers
     * (Plex, Jellyfin, Emby) index sidecar .srt files, and an extracted French track would
     * otherwise appear as a selectable subtitle mid-run.
     */
    dispose: () => void;
}

const NO_CLEANUP = (): void => {
    // A sidecar the user already had. Nothing to release.
};

/** Only ever called with a directory this module created via mkdtempSync. */
function removeDir(dir: string): void {
    fs.rmSync(dir, { recursive: true, force: true });
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

const DEFAULT_VIDEO_EXTENSIONS = ["mkv", "mp4", "avi"];
const SUBS_FOLDER_NAMES = ["subs", "subtitles"];

export class ReferenceSourceFinder implements ReferenceSourceFinderInterface {
    private readonly videoExtensions: string[];

    constructor(
        private readonly languages: string[],
        private readonly targetLanguage: string,
        private readonly mkvExtractor: MkvExtractorInterface,
        private readonly logger: LoggerInterface,
        videoExtensions: string[] = DEFAULT_VIDEO_EXTENSIONS
    ) {
        // Honour the same `extensions` list the download flow uses, so adding "m4v" there is
        // not silently ignored here. Normalised to a leading dot for path.extname comparison.
        this.videoExtensions = videoExtensions.map((ext) => (ext.startsWith(".") ? ext : `.${ext}`).toLowerCase());
    }

    async find(targetSrtPath: string): Promise<ReferenceLookup> {
        const dir = path.dirname(targetSrtPath);
        const stem = deriveStem(path.parse(targetSrtPath).name, strippableTags(this.targetLanguage));
        // Scene releases put the video one level up from a Subs/ folder.
        const searchDirs = SUBS_FOLDER_NAMES.includes(path.basename(dir).toLowerCase())
            ? [dir, path.dirname(dir)]
            : [dir];

        this.logger.verbose(`Sync: Target "${path.basename(targetSrtPath)}" -> stem "${stem}"`);

        const video = await this.findVideo(stem, searchDirs);

        // Embedded first: an embedded track is guaranteed to be timed against this very
        // video file, whereas a sidecar may have been downloaded for a different release.
        let bitmapOnlyLanguages: string[] = [];
        let unsupportedLanguages: string[] = [];
        if (video && path.extname(video).toLowerCase() === ".mkv") {
            const embedded = await this.extractEmbedded(video, stem, targetSrtPath);
            if (embedded.source) {
                return embedded;
            }
            bitmapOnlyLanguages = embedded.bitmapOnlyLanguages;
            unsupportedLanguages = embedded.unsupportedLanguages;
        }

        const sidecar = await this.findSidecar(stem, searchDirs, targetSrtPath);
        if (sidecar) {
            return { source: sidecar };
        }

        if (unsupportedLanguages.length > 0) {
            const languages = unsupportedLanguages.map((l) => l.toUpperCase()).join(" and ");
            const suggestion = unsupportedLanguages.map((l) => `.${l}.srt`).join(" or ");
            this.logger.warn(
                `Sync: ${languages} subtitles exist in the MKV as ASS/SSA tracks. This tool reads SubRip only. ` +
                `Convert the track to SRT, or place a ${unsupportedLanguages.map((l) => `${stem}.${l}.srt`).join(" or ")} next to the video.`
            );
            return {
                source: null,
                reason: `${languages} subtitles in the video use the ASS/SSA format, which this tool cannot read. `
                    + `Add a ${suggestion} file next to the video.`
            };
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
            for (const ext of this.videoExtensions) {
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
                .filter((item) => this.videoExtensions.includes(path.extname(item).toLowerCase()))
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
    ): Promise<{ source: ReferenceSource | null; bitmapOnlyLanguages: string[]; unsupportedLanguages: string[] }> {
        const none = { source: null, bitmapOnlyLanguages: [] as string[], unsupportedLanguages: [] as string[] };

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
            return { source: null, bitmapOnlyLanguages: search.bitmapOnlyLanguages, unsupportedLanguages: search.unsupportedLanguages };
        }

        // A sidecar left by an older build, next to the video. Reuse it rather than paying
        // for extraction again, but do not adopt the clicked file as its own reference.
        const sidecarPath = path.join(path.dirname(video), `${stem}.${track.language}.srt`);
        if (!samePath(sidecarPath, targetSrtPath) && await isExist(sidecarPath)) {
            this.logger.verbose(`Sync: Reusing previously extracted ${track.language} reference at ${sidecarPath}`);
            return { source: { srtPath: sidecarPath, language: track.language, origin: "embedded", dispose: NO_CLEANUP }, bitmapOnlyLanguages: [], unsupportedLanguages: [] };
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
            source: { srtPath: outPath, language: track.language, origin: "embedded", dispose: () => removeDir(tempDir) },
            bitmapOnlyLanguages: [],
            unsupportedLanguages: []
        };
    }

    private async findSidecar(stem: string, dirs: string[], targetSrtPath: string): Promise<ReferenceSource | null> {
        for (const language of this.languages) {
            for (const suffix of aliasesFor(language)) {
                for (const dir of dirs) {
                    const candidate = path.join(dir, `${stem}.${suffix}.srt`);
                    // Never let the file the user clicked become its own reference.
                    if (samePath(candidate, targetSrtPath)) {
                        continue;
                    }
                    if (await isExist(candidate)) {
                        this.logger.info(`Sync: Using ${language} sidecar reference ${path.basename(candidate)}`);
                        return { srtPath: candidate, language, origin: "sidecar", dispose: NO_CLEANUP };
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

