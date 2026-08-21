import type { LoggerInterface } from "~src/logger";
import { isExistSync, readJsonSync, writeJsonSync } from "~src/fileUtils";

interface ReplacePairsInterface {
    [key: string]: string;
}

/**
 * Sync knobs. `syncEnabled` is deliberately absent: Flow B is entered by choosing
 * "Sync subtitle" on a .srt, which is both the request and the consent.
 */
export interface SyncConfig {
    referenceLanguages: string[];
    splitPenaltyMs: number;
    maxOffsetMs: number;
    minSegmentEntries: number;
    minConfidence: number;
}

interface ConfigurationInterface {
    logLevel: string;
    extensions: string[];
    replacePairs: ReplacePairsInterface;
    languageCode: string;
    referenceLanguages: string[];
    splitPenaltyMs: number;
    maxOffsetMs: number;
    minSegmentEntries: number;
    minConfidence: number;
    checkEmbeddedSubtitles: boolean;
}

const defaultExtensions: string[] = ["mkv", "mp4", "avi"];
const defaultConf: ConfigurationInterface = {
    logLevel: "debug",
    extensions: defaultExtensions,
    replacePairs: {},
    languageCode: "Hebrew",
    referenceLanguages: ["fr", "en"],
    splitPenaltyMs: 7000,
    maxOffsetMs: 180_000,
    minSegmentEntries: 3,
    minConfidence: 0.25,
    checkEmbeddedSubtitles: false
};

export interface ConfigInterface {
    replaceTitleIfNeeded: (text: string) => string;
    getLogLevel: () => string;
    getExtensions: () => string[];
    getLanguageCode: () => string;
    getSyncConfig: () => SyncConfig;
    getCheckEmbeddedSubtitles: () => boolean;
}

export class Config implements ConfigInterface {
    private readonly logLevel: string;
    private readonly logger: LoggerInterface;
    private readonly replacePairs: ReplacePairsInterface;
    private readonly extensions: string[];
    private readonly languageCode: string;
    private readonly syncConfig: SyncConfig;
    private readonly checkEmbeddedSubtitles: boolean;

    constructor(confFile: string, logger: LoggerInterface) {
        this.logger = logger;
        if (!isExistSync(confFile)) {
            writeJsonSync(confFile, defaultConf);
        }
        let conf: ConfigurationInterface;
        try {
            conf = readJsonSync(confFile);
        }
        catch (e) {
            this.logger.error("Configuration file corrupted. Using default.");
            conf = defaultConf;
        }
        this.logLevel = conf?.logLevel;
        this.logger.debug(`LogLevel ${this.logLevel}`);
        this.extensions = conf?.extensions ?? defaultExtensions;
        this.replacePairs = conf?.replacePairs
            ? Object.freeze(Object.fromEntries(Object.entries(conf.replacePairs).map(([k, v]) => [k.toLowerCase(), v])))
            : Object.freeze({});
        this.languageCode = conf?.languageCode ?? "Hebrew";
        this.syncConfig = {
            referenceLanguages: conf?.referenceLanguages ?? defaultConf.referenceLanguages,
            splitPenaltyMs: conf?.splitPenaltyMs ?? defaultConf.splitPenaltyMs,
            maxOffsetMs: conf?.maxOffsetMs ?? defaultConf.maxOffsetMs,
            minSegmentEntries: conf?.minSegmentEntries ?? defaultConf.minSegmentEntries,
            minConfidence: conf?.minConfidence ?? defaultConf.minConfidence
        };
        this.checkEmbeddedSubtitles = conf?.checkEmbeddedSubtitles ?? false;
        this.logger.debug(
            `Replace pairs (${Object.keys(this.replacePairs).length}): ${Object.keys(this.replacePairs)
                .map((pairKey) => pairKey + " => " + this.replacePairs[pairKey])
                .join("; ")}`
        );
    }

    public replaceTitleIfNeeded(text: string): string {
        const replacement = this.replacePairs[text.toLowerCase()];
        if (replacement) {
            this.logger.info(`Replaced "${text}" with "${replacement}" for query`);
            return replacement;
        }
        return text;
    }

    public getLogLevel(): string {
        return this.logLevel;
    }

    public getExtensions(): string[] {
        return this.extensions;
    }

    public getLanguageCode(): string {
        return this.languageCode;
    }

    public getSyncConfig(): SyncConfig {
        return this.syncConfig;
    }

    public getCheckEmbeddedSubtitles(): boolean {
        return this.checkEmbeddedSubtitles;
    }
}
