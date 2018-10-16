import * as winston from 'winston';
const { combine, timestamp, printf, label } = winston.format;

export interface ISzLogger {
    // new(logFile: string): SzLogger;
    setLogLevel(level: string);
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
            format: combine(
                label({ label: '[my-label]' }),
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
                printf(info => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
            ),
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
