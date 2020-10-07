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
        // eslint-disable-next-line security/detect-object-injection
        logger[level]("mock message");
        expect(mockLog).toBeCalledTimes(1);
        expect(mockLog.mock.calls[0][0]).toEqual(level);
        expect(mockLog.mock.calls[0][1]).toEqual("mock message");
    });
    it("Test getLogFileLocation", () => {
        const logger = new Logger("mockLogFile");
        const logFileLocation = logger.getLogFileLocation();
        expect(logFileLocation).toEqual("mockLogFile");
    });
});