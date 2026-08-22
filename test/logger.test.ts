import { Logger } from "../src/logger";

const mockLog = jest.fn();
jest.mock("winston", () => ({
    transports: {
        File: function() {
            return {
            };
        }
    },
    createLogger: function() {
        return {
            log: mockLog
        };
    },
    format: {
        combine: jest.fn(),
        timestamp: jest.fn(),
        printf: jest.fn(),
        label: jest.fn()
    }
}));



describe("Test logger", () => {
    it.each(["info", "debug", "verbose", "warn", "error"])("Test logger %s", (level) => {
        const logger = new Logger("mockLogFile");
        logger[level]("mock message");
        expect(mockLog).toHaveBeenCalledTimes(1);
        expect(mockLog.mock.calls[0][0]).toEqual(level);
        expect(mockLog.mock.calls[0][1]).toEqual("mock message");
    });
    it("Test getLogFileLocation", () => {
        const logger = new Logger("mockLogFile");
        const logFileLocation = logger.getLogFileLocation();
        expect(logFileLocation).toEqual("mockLogFile");
    });

    it("setLogLevel with a truthy level sets the transport level", () => {
        const logger = new Logger("mockLogFile");
        expect(() => logger.setLogLevel("info")).not.toThrow();
    });

    it("setLogLevel with an empty string is a no-op", () => {
        const logger = new Logger("mockLogFile");
        expect(() => logger.setLogLevel("")).not.toThrow();
    });
});