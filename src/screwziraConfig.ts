const fs = require('fs');
const fsextra = require("fs-extra");
import {PathLike} from "fs";
import {Logger} from "winston";

interface ReplacePairs {
    [key: string]: string;
}

export interface IScrewziraConfig {
    new (confFile: PathLike, logger: Logger): ScrewziraConfig;
    replaceTitleIfNeeded(text: string): string;
}

class ScrewziraConfig {
    replacePairs: ReplacePairs;
    logger: Logger;

    constructor(confFile: PathLike, logger: Logger) {
        this.logger = logger;
        if (!fs.existsSync(confFile)) {
            fsextra.outputJsonSync(confFile, { replacePairs: {} });
        }
        const conf = fsextra.readJsonSync(confFile);
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
}