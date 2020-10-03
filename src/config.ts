import * as fs from "fs";
import * as fsextra from "fs-extra";
import { LoggerInterface } from "~src/logger";

interface ReplacePairsInterface {
    [key: string]: string;
}

interface ConfigurationInterface {
    logLevel: string;
    extensions: string[];
    replacePairs: ReplacePairsInterface;
}

const defaultExtensions: string[] = ["mkv", "mp4", "avi"];
const defaultConf: ConfigurationInterface = { logLevel: "debug", extensions: defaultExtensions, replacePairs: {} };

export interface ConfigInterface {
    replaceTitleIfNeeded: (text: string) => string;
    getLogLevel: () => string;
    getExtensions: () => string[];
}

export class Config implements ConfigInterface {
    private readonly logLevel: string;
    private readonly logger: LoggerInterface;
    private readonly replacePairs: ReplacePairsInterface;
    private readonly extensions: string[];

    constructor(confFile: string, logger: LoggerInterface) {
        this.logger = logger;
        if (!fs.existsSync(confFile)) {
            fsextra.outputJsonSync(confFile, defaultConf);
        }
        let conf: ConfigurationInterface;
        try {
            conf = fsextra.readJsonSync(confFile);
        }
        catch (e) {
            this.logger.error("Configuration file corrupted. Using default.");
            conf = defaultConf;
        }
        this.logLevel = conf?.logLevel;
        this.logger.debug(`LogLevel ${this.logLevel}`);
        this.extensions = conf?.extensions ?? defaultExtensions;
        this.replacePairs = conf?.replacePairs ? Object.freeze(JSON.parse(JSON.stringify(conf.replacePairs).toLowerCase())) : Object.freeze({});
        this.logger.debug(
            `Replace pairs (${Object.keys(this.replacePairs).length}): ${Object.keys(this.replacePairs)
                .map((pairKey) => pairKey + " => " + this.replacePairs[pairKey])
                .join("; ")}`
        );
    }

    public replaceTitleIfNeeded = (text: string): string => {
        if (this.replacePairs[text]) {
            this.logger.info(`Replaced "${text}" with "${this.replacePairs[text]}" for query`);
            return this.replacePairs[text];
        }
        return text;
    };

    public getLogLevel = (): string => {
        return this.logLevel;
    };

    public getExtensions = (): string[] => {
        return this.extensions;
    };
}
