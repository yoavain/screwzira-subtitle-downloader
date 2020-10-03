// Mock first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const mockFsWriteFileSync = jest.fn((destination, response) => {
    console.log(`Writing file: ${destination} with ${response.size} bytes`);
});
fs.writeFileSync = mockFsWriteFileSync;

import * as path from "path";
import { ParserInterface } from "~src/parsers/parserInterface";
import { Classifier, ClassifierInterface } from "~src/classifier";
import { LoggerInterface } from "~src/logger";
import { NotifierInterface } from "~src/notifier";
import { ConfigInterface } from "~src/config";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import { MockConfig, MockLogger, MockNotifier } from "~test/__mocks__";

describe("Test ktuvit parser", () => {
    it("Test fetch file", async () => {
        const email: string = process.env.KTUVIT_EMAIL;
        const password: string = process.env.KTUVIT_PASSWORD;

        const logger: LoggerInterface = new MockLogger();
        const notifier: NotifierInterface = new MockNotifier();
        const config: ConfigInterface = new MockConfig();

        // File classifier
        const classifier: ClassifierInterface = new Classifier(logger, config);

        // Ktuvit Parser
        const ktuvitParser: ParserInterface = new KtuvitParser(email, password, logger, notifier, classifier);

        await ktuvitParser.handleMovie("Frozen", 2013, "Frozen.2013.1080p.BluRay.x264-HebDub", ".");
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", "..", "..", "Frozen.2013.1080p.BluRay.x264-HebDub.Hebrew.srt"));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});