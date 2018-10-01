import {ISzLogger} from './szLogger';
import {PathLike} from 'fs';
const fs = require('fs');
const fsextra = require('fs-extra');

interface ReplacePairs {
    [key: string]: string;
}

export interface ISzConfig {
    new(confFile: PathLike, logger: ISzLogger): SzConfig;
    replaceTitleIfNeeded(text: string): string;
    getLogLevel(): string;
}

class SzConfig {
    logLevel: string;
    replacePairs: ReplacePairs;
    logger: ISzLogger;

    constructor(confFile: PathLike, logger: ISzLogger) {
        this.logger = logger;
        if (!fs.existsSync(confFile)) {
            fsextra.outputJsonSync(confFile, {logLevel: "debug", replacePairs: {}});
        }
        const conf = fsextra.readJsonSync(confFile);
        this.logLevel = conf && conf.logLevel;
        this.logger.log('debug', `LogLevel ${this.logLevel}`);
        this.replacePairs = conf && conf.replacePairs ? Object.freeze(JSON.parse(JSON.stringify(conf.replacePairs).toLowerCase())) : Object.freeze({});
        this.logger.log('debug', `Replace pairs (${Object.keys(this.replacePairs).length}): ${Object.keys(this.replacePairs).map(pairKey => pairKey + " => " + this.replacePairs[pairKey]).join('; ')}`);
    }

    replaceTitleIfNeeded = (text: string): string => {
        if (this.replacePairs[text]) {
            this.logger.log('info', `Replaced "${text}" with "${this.replacePairs[text]}" for query`);
            return this.replacePairs[text];
        }
        return text;
    };

    getLogLevel = () => {
        return this.logLevel;
    }
}

module.exports = SzConfig;