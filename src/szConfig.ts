import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import { ISzLogger } from './szLogger';

interface IReplacePairs {
    [key: string]: string;
}

interface IConfig {
    logLevel: string;
    extensions: string[];
    replacePairs: IReplacePairs;
}

const defaultExtensions: string[] = ['mkv', 'mp4', 'avi'];
const defaultConf: IConfig = { logLevel: 'debug', extensions: defaultExtensions, replacePairs: {} };

export interface ISzConfig {
    // new(confFile: string, logger: ISzLogger): SzConfig;
    replaceTitleIfNeeded: (text: string) => string;
    getLogLevel: () => string;
    getExtensions: () => string[];
}

export class SzConfig implements ISzConfig {
    private readonly logLevel: string;
    private readonly logger: ISzLogger;
    private readonly replacePairs: IReplacePairs;
    private readonly extensions: string[];

    constructor(confFile: string, logger: ISzLogger) {
        this.logger = logger;
        if (!fs.existsSync(confFile)) {
            fsextra.outputJsonSync(confFile, defaultConf);
        }
        let conf: IConfig;
        try {
            conf = fsextra.readJsonSync(confFile);
        }
        catch (e) {
            this.logger.error('Configuration file corrupted. Using default.');
            conf = defaultConf;
        }
        this.logLevel = conf?.logLevel;
        this.logger.debug(`LogLevel ${this.logLevel}`);
        this.extensions = conf?.extensions ?? defaultExtensions;
        this.replacePairs = conf?.replacePairs ? Object.freeze(JSON.parse(JSON.stringify(conf.replacePairs).toLowerCase())) : Object.freeze({});
        this.logger.debug(`Replace pairs (${Object.keys(this.replacePairs).length}): ${Object.keys(this.replacePairs).map(pairKey => pairKey + ' => ' + this.replacePairs[pairKey]).join('; ')}`);
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
    }
}
