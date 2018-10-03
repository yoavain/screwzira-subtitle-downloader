import * as fs from 'fs';
import * as fsextra from 'fs-extra';
import {ISzLogger} from './szLogger';

interface IReplacePairs {
    [key: string]: string;
}

const defaultExtensions = ["mkv", "avi"];

export interface ISzConfig {
    // new(confFile: string, logger: ISzLogger): SzConfig;
    replaceTitleIfNeeded(text: string): string;
    getLogLevel(): string;
}

export class SzConfig implements ISzConfig {
    public logLevel: string;
    public replacePairs: IReplacePairs;
    public logger: ISzLogger;
    public extensions: string[];

    constructor(confFile: string, logger: ISzLogger) {
        this.logger = logger;
        if (!fs.existsSync(confFile)) {
            fsextra.outputJsonSync(confFile, {logLevel: "debug", extensions: defaultExtensions, replacePairs: {}});
        }
        const conf = fsextra.readJsonSync(confFile);
        this.logLevel = conf && conf.logLevel;
        this.logger.log('debug', `LogLevel ${this.logLevel}`);
        this.extensions = conf && conf.extensions ? conf.extensions : defaultExtensions;
        this.replacePairs = conf && conf.replacePairs ? Object.freeze(JSON.parse(JSON.stringify(conf.replacePairs).toLowerCase())) : Object.freeze({});
        this.logger.log('debug', `Replace pairs (${Object.keys(this.replacePairs).length}): ${Object.keys(this.replacePairs).map(pairKey => pairKey + " => " + this.replacePairs[pairKey]).join('; ')}`);
    }

    public replaceTitleIfNeeded = (text: string): string => {
        if (this.replacePairs[text]) {
            this.logger.log('info', `Replaced "${text}" with "${this.replacePairs[text]}" for query`);
            return this.replacePairs[text];
        }
        return text;
    };

    public getLogLevel = (): string => {
        return this.logLevel;
    };

    public getExtensions = ():string[] => {
        return this.extensions;
    }
}
