import {Logger} from 'winston';
import {PathLike} from 'fs';
import {FileTransportInstance} from 'winston/lib/winston/transports';

const winston = require('winston');

export interface ISzLogger {
    new(logFile: PathLike): SzLogger;
    setLogLevel(level: string);
    log(level: string, message: string);
}

class SzLogger {
    transports: { file: FileTransportInstance };
    logger: Logger;

    constructor(logFile: string) {
        this.transports = {
            file: new winston.transports.File({filename: logFile})
        };
        this.logger = winston.createLogger({
            level: 'debug',
            transports: [this.transports.file]
        });
    }

    setLogLevel = (level: string) => {
        if (level) {
            this.transports.file.level = level;
        }
    };

    log = (level: string, message: string) => {
        this.logger.log(level, message);
    }
}

module.exports = SzLogger;

