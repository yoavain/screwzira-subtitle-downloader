import type { ClassifierInterface, MovieFileClassificationInterface, TvEpisodeFileClassificationInterface } from "~src/classifier";
import { Classifier, DIMENSION_MARK, ENCODING_MARK, RIP_MARK, SPECIAL_EDITION_MARK } from "~src/classifier";
import type { ConfigInterface } from "~src/config";
import { Config } from "~src/config";
import type { LoggerInterface } from "~src/logger";
import { MockLogger } from "./__mocks__";

const mockLogger: LoggerInterface = new MockLogger();

const mockConfig: ConfigInterface = new Config("resources/screwzira-downloader-config.json", mockLogger);

describe("test classify", () => {
    it("test movie name ends with number", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("Deadpool.2.2018.THEATRICAL.1080p.BluRay.x264-ROVERS", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "Deadpool.2.2018.THEATRICAL.1080p.BluRay.x264-ROVERS",
            relativePath: ".",
            type: "movie",
            movieName: "deadpool 2",
            movieYear: 2018
        });
    });
    it("test movie name ends with space instead of dot", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("Deadpool 2 2018 THEATRICAL 1080p BluRay x264-ROVERS", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "Deadpool 2 2018 THEATRICAL 1080p BluRay x264-ROVERS",
            relativePath: ".",
            type: "movie",
            movieName: "deadpool 2",
            movieYear: 2018
        });
    });
    it("test movie name with irrelevant numbers", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("The.House.That.Jack.Built.2018.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "The.House.That.Jack.Built.2018.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG",
            relativePath: ".",
            type: "movie",
            movieName: "the house that jack built",
            movieYear: 2018
        });
    });
    it("test calculateSimilarityMark - unknown words", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actualOneLetterMark: number = szClassifier.calculateSimilarityMark(["a"]);
        expect(actualOneLetterMark).toEqual(0.2);
        const actualTwoLetterMark: number = szClassifier.calculateSimilarityMark(["ab"]);
        expect(actualTwoLetterMark).toEqual(0.4);
        const actualSixLetterMark: number = szClassifier.calculateSimilarityMark(["abcdef"]);
        expect(actualSixLetterMark).toEqual(1);
    });
    it("test calculateSimilarityMark - known words", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const encodingMark: number = szClassifier.calculateSimilarityMark(["x264"]);
        expect(encodingMark).toEqual(ENCODING_MARK);
        const dimensionMark: number = szClassifier.calculateSimilarityMark(["720p"]);
        expect(dimensionMark).toEqual(DIMENSION_MARK);
        const ripMark: number = szClassifier.calculateSimilarityMark(["web", "dl"]);
        expect(ripMark).toEqual(RIP_MARK);
        const specialEditionMark: number = szClassifier.calculateSimilarityMark(["final", "cut"]);
        expect(specialEditionMark).toEqual(SPECIAL_EDITION_MARK);
    });
    it("test special episode name (season 00)", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("Stranger.Things.S00E01.1080p.WEB.x264-STRiFE", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "Stranger.Things.S00E01.1080p.WEB.x264-STRiFE",
            relativePath: ".",
            type: "episode",
            series: "stranger things",
            season: 0,
            episode: 1
        });
    });
    it("test lowercase episode name", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("living.with.yourself.s01e01.internal.hdr.1080p.web.h265-paleale", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "living.with.yourself.s01e01.internal.hdr.1080p.web.h265-paleale",
            relativePath: ".",
            type: "episode",
            series: "living with yourself",
            season: 1,
            episode: 1
        });
    });
    it("test frozen 2 classification", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const actual: MovieFileClassificationInterface | TvEpisodeFileClassificationInterface = szClassifier.classify("Frozen.2.2019.1080p.AMZN.WEB-DL.DDP5.1.H264-CMRG", ".", "");
        expect(actual).toEqual({
            filenameNoExtension: "Frozen.2.2019.1080p.AMZN.WEB-DL.DDP5.1.H264-CMRG",
            relativePath: ".",
            type: "movie",
            movieName: "frozen 2",
            movieYear: 2019
        });
    });
    it("test findAlternativeName - frozen 2", () => {
        const szClassifier: ClassifierInterface = new Classifier(mockLogger, mockConfig);
        const alternativeMovieName: string = szClassifier.findAlternativeName("frozen 2");
        expect(alternativeMovieName).toEqual("frozen ii");
    });
});
