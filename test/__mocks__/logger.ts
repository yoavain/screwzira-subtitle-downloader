import { LoggerInterface } from "~src/logger";

export class MockLogger implements LoggerInterface {
    setLogLevel = () => null;
    info = (message: string): void => console.log(`Notification: ${message}`);
    debug = (message: string): void => console.log(`Notification: ${message}`);
    verbose = (message: string): void => console.log(`Notification: ${message}`);
    warn = (message: string): void => console.log(`Notification: ${message}`);
    error = (message: string): void => console.log(`Notification: ${message}`);
}
