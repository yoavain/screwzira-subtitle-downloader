// Mock first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const mockFsWriteFileSync = jest.fn((destination, response) => {
    console.log(`Writing file: ${destination} with ${response.size} bytes`);
});
fs.writeFileSync = mockFsWriteFileSync;

import * as path from "path";
import type { ClassifierInterface } from "~src/classifier";
import { Classifier, SUBTITLES_SUFFIX } from "~src/classifier";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import { MockConfig, MockLogger, MockNotifier } from "~test/__mocks__";
import type { ParserInterface } from "~src/parsers/parserInterface";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ConfigInterface } from "~src/config";

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

        const movieName = "Frozen";
        const movieYear = 2013;
        const filenameNoExtension = "Frozen.2013.1080p.BluRay.x264.SPARKS";
        await ktuvitParser.handleMovie(movieName, movieYear, filenameNoExtension, ".");
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", "..", "..", `${filenameNoExtension}.${SUBTITLES_SUFFIX}`));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});