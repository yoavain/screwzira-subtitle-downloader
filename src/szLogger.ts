import * as winston from 'winston';

export interface ISzLogger {
    // new(logFile: string): SzLogger;
    setLogLevel(level: string, x: string);
    log(level: string, message: string);
}

export class SzLogger implements ISzLogger {
    public transports: { file: winston.transports.FileTransportInstance };
    public logger: winston.Logger;

    constructor(logFile: string) {
        this.transports = {
            file: new winston.transports.File({filename: logFile})
        };
        this.logger = winston.createLogger({
            level: 'debug',
            transports: [this.transports.file]
        });
    }

    public setLogLevel = (level: string) => {
        if (level) {
            this.transports.file.level = level;
        }
    };

    public log = (level: string, message: string) => {
        this.logger.log(level, message);
    }
}
