// Mock first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const mockFsWriteFileSync = jest.fn((destination, response) => {
    console.log(`Writing file: ${destination} with ${response.size} bytes`);
});
fs.writeFileSync = mockFsWriteFileSync;

import type { ClassifierInterface, MovieFileClassificationInterface } from "~src/classifier";
import { Classifier, FileClassification } from "~src/classifier";
import { ScrewziraParser } from "~src/parsers/screwzira/screwziraParser";
import { MockConfig, MockLogger, MockNotifier } from "~test/__mocks__";
import * as path from "path";
import type { ParserInterface } from "~src/parsers/parserInterface";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ConfigInterface } from "~src/config";

describe("Test screwzira parser", () => {
    it.skip("Test fetch file", async () => {
        const logger: LoggerInterface = new MockLogger();
        const notifier: NotifierInterface = new MockNotifier();
        const config: ConfigInterface = new MockConfig();

        // File classifier
        const classifier: ClassifierInterface = new Classifier(logger, config);

        // Screwzira Parser
        const screwziraParser: ParserInterface = new ScrewziraParser(logger, notifier, classifier);

        const filenameNoExtension = "Frozen.2013.1080p.BluRay.x264.SPARKS";
        const movieFile: MovieFileClassificationInterface = {
            filenameNoExtension: filenameNoExtension,
            relativePath: ".",
            type: FileClassification.MOVIE,
            movieName: "Frozen",
            movieYear : 2013
        };
        await screwziraParser.handleMovie(movieFile);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", `${filenameNoExtension}.${classifier.getSubtitlesSuffix()}`));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});
