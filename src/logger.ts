import * as winston from "winston";

const { combine, timestamp, printf, label } = winston.format;

export interface LoggerInterface {
    setLogLevel: (level: string) => void;
    info: (message: string) => void;
    debug: (message: string) => void;
    verbose: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
    getLogFileLocation: () => string;
}

export class Logger implements LoggerInterface {
    private readonly logFile: string;
    private transports: { file: winston.transports.FileTransportInstance };
    private logger: winston.Logger;

    constructor(logFile: string) {
        this.logFile = logFile;
        this.transports = {
            file: new winston.transports.File({ filename: logFile })
        };
        this.logger = winston.createLogger({
            level: "debug",
            format: combine(
                label({ label: "[my-label]" }),
                timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
                printf((info) => `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`)
            ),
            transports: [this.transports.file]
        });
    }

    public setLogLevel = (level: string): void => {
        if (level) {
            this.transports.file.level = level;
        }
    };

    public info = (message: string): void => {
        this.log("info", message);
    };

    public debug = (message: string): void => {
        this.log("debug", message);
    };

    public verbose = (message: string): void => {
        this.log("verbose", message);
    };

    public warn = (message: string): void => {
        this.log("warn", message);
    };

    public error = (message: string): void => {
        this.log("error", message);
    };

    public getLogFileLocation = (): string => {
        return this.logFile;
    };

    private log = (level: winston.level, message: string): void => {
        this.logger.log(level, message);
    };
}
