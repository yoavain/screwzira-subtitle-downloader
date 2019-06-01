import * as winston from 'winston';

const {combine, timestamp, printf, label} = winston.format;

export interface ISzLogger {
    // new(logFile: string): SzLogger;
    setLogLevel: (level: string) => void;
    info: (message: string) => void;
    debug: (message: string) => void;
    verbose: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
}

export class SzLogger implements ISzLogger {
    private transports: { file: winston.transports.FileTransportInstance };
    private logger: winston.Logger;

    constructor(logFile: string) {
        this.transports = {
            file: new winston.transports.File({filename: logFile})
        };
        this.logger = winston.createLogger({
            level: 'debug',
            format: combine(
                label({label: '[my-label]'}),
                timestamp({format: 'YYYY-MM-DD HH:mm:ss.SSS'}),
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

    public info = (message: string) => {
        this.log('info', message);
    };

    public debug = (message: string) => {
        this.log('debug', message);
    };

    public verbose = (message: string) => {
        this.log('verbose', message);
    };

    public warn = (message: string) => {
        this.log('warn', message);
    };

    public error = (message: string) => {
        this.log('error', message);
    };


    private log = (level: string, message: string) => {
        this.logger.log(level, message);
    };
}
