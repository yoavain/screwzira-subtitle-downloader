// Mock first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const mockFsWriteFileSync = jest.fn((destination, response) => {
    console.log(`Writing file: ${destination} with ${response.size} bytes`);
});
fs.writeFileSync = mockFsWriteFileSync;

import * as path from "path";
import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { Classifier, FileClassification } from "~src/classifier";
import { KtuvitParser } from "~src/parsers/ktuvit/ktuvitParser";
import { MockConfig, MockLogger, MockNotifier } from "~test/__mocks__";
import type { ParserInterface } from "~src/parsers/parserInterface";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ConfigInterface } from "~src/config";

jest.setTimeout(20000);

describe("Test ktuvit parser", () => {
    it("Test fetch file - movie", async () => {
        const email: string = process.env.KTUVIT_EMAIL;
        const password: string = process.env.KTUVIT_PASSWORD;

        const logger: LoggerInterface = new MockLogger();
        const notifier: NotifierInterface = new MockNotifier();
        const config: ConfigInterface = new MockConfig();

        // File classifier
        const classifier: ClassifierInterface = new Classifier(logger, config);

        // Ktuvit Parser
        const ktuvitParser: ParserInterface = new KtuvitParser(email, password, logger, notifier, classifier);

        const filenameNoExtension = "Frozen.2013.1080p.BluRay.x264.SPARKS";
        const movieFile: MovieFileClassificationInterface = {
            filenameNoExtension: filenameNoExtension,
            relativePath: ".",
            type: FileClassification.MOVIE,
            movieName: "Frozen",
            movieYear : 2013
        };
        await ktuvitParser.handleMovie(movieFile);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", "..", "..", `${filenameNoExtension}.${classifier.getSubtitlesSuffix()}`));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });

    it("Test fetch file - series", async () => {
        const email: string = process.env.KTUVIT_EMAIL;
        const password: string = process.env.KTUVIT_PASSWORD;

        const logger: LoggerInterface = new MockLogger();
        const notifier: NotifierInterface = new MockNotifier();
        const config: ConfigInterface = new MockConfig();

        // File classifier
        const classifier: ClassifierInterface = new Classifier(logger, config);

        // Ktuvit Parser
        const ktuvitParser: ParserInterface = new KtuvitParser(email, password, logger, notifier, classifier);

        const filenameNoExtension = "The Simpsons - S01E01 - Christmas Special - Simpsons Roasting on an Open Fir.avi";
        const tvEpisodeFile: TvEpisodeFileClassificationInterface = {
            filenameNoExtension: filenameNoExtension,
            relativePath: ".",
            type: FileClassification.EPISODE,
            series: "The Simpsons",
            episode: 1,
            season: 1
        };
        await ktuvitParser.handleEpisode(tvEpisodeFile);
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", "..", "..", `${filenameNoExtension}.${classifier.getSubtitlesSuffix()}`));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});
