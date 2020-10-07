import type { LoggerInterface } from "~src/logger";

export class MockLogger implements LoggerInterface {
    setLogLevel = () => null;
    info = (message: string): void => console.log(`Logger [info]: ${message}`);
    debug = (message: string): void => console.log(`Logger [debug]: ${message}`);
    verbose = (message: string): void => console.log(`Logger [verbose]: ${message}`);
    warn = (message: string): void => console.log(`Logger [warn]: ${message}`);
    error = (message: string): void => console.log(`Logger [error]: ${message}`);
    getLogFileLocation = (): string => "loggerFileLocation";
}
