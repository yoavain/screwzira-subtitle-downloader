import type { LoggerInterface } from "~src/logger";
import { isExistSync, readJsonSync, writeJsonSync } from "~src/fileUtils";
import type { SyncConfig } from "~src/sync/types";

interface ReplacePairsInterface {
    [key: string]: string;
}

interface ConfigurationInterface {
    logLevel: string;
    extensions: string[];
    replacePairs: ReplacePairsInterface;
    languageCode: string;
    syncEnabled: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    syncChunkThresholdSeconds: number;
    syncBatchSize: number;
}

const defaultExtensions: string[] = ["mkv", "mp4", "avi"];
const defaultConf: ConfigurationInterface = {
    logLevel: "debug",
    extensions: defaultExtensions,
    replacePairs: {},
    languageCode: "Hebrew",
    syncEnabled: false,
    ollamaBaseUrl: "",
    ollamaModel: "translategemma:12b",
    syncChunkThresholdSeconds: 0.3,
    syncBatchSize: 20
};

export interface ConfigInterface {
    replaceTitleIfNeeded: (text: string) => string;
    getLogLevel: () => string;
    getExtensions: () => string[];
    getLanguageCode: () => string;
    getSubtitlesSuffix: () => string;
    getSyncConfig: () => SyncConfig;
}

export class Config implements ConfigInterface {
    private readonly logLevel: string;
    private readonly logger: LoggerInterface;
    private readonly replacePairs: ReplacePairsInterface;
    private readonly extensions: string[];
    private readonly languageCode: string;
    private readonly syncEnabled: boolean;
    private readonly ollamaBaseUrl: string;
    private readonly ollamaModel: string;
    private readonly syncChunkThresholdSeconds: number;
    private readonly syncBatchSize: number;

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
        this.syncEnabled = conf?.syncEnabled ?? false;
        this.ollamaBaseUrl = conf?.ollamaBaseUrl ?? "";
        this.ollamaModel = conf?.ollamaModel ?? "translategemma:12b";
        this.syncChunkThresholdSeconds = conf?.syncChunkThresholdSeconds ?? 0.3;
        this.syncBatchSize = conf?.syncBatchSize ?? 20;
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

    public getSubtitlesSuffix(): string {
        return `${this.languageCode}.srt`;
    }

    public getSyncConfig(): SyncConfig {
        return {
            syncEnabled: this.syncEnabled,
            ollamaBaseUrl: this.ollamaBaseUrl,
            ollamaModel: this.ollamaModel,
            syncChunkThresholdSeconds: this.syncChunkThresholdSeconds,
            syncBatchSize: this.syncBatchSize
        };
    }
}
