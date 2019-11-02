import { DIMENSION_MARK, ENCODING_MARK, ISzClassifier, RIP_MARK, SPECIAL_EDITION_MARK, SzClassifier } from "../src/szClassifier";
import { ISzConfig, SzConfig } from "../src/szConfig";
import { ISzLogger } from "../src/szLogger";

const mockLogger: ISzLogger = {
    setLogLevel() {
        jest.fn()
    },
    info() {
        jest.fn()
    },
    debug() {
        jest.fn()
    },
    verbose() {
        jest.fn()
    },
    warn() {
        jest.fn()
    },
    error() {
        jest.fn()
    }
};

const mockConfig: ISzConfig = new SzConfig("resources/screwzira-downloader-config.json", mockLogger);

describe("test classify", () => {
    it("test movie name ends with number", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("Deadpool.2.2018.THEATRICAL.1080p.BluRay.x264-ROVERS", "");
        expect(actual).toEqual({ type: "movie", movieName: "deadpool 2", movieYear: 2018 });
    });
    it("test movie name ends with space instead of dot", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("Deadpool 2 2018 THEATRICAL 1080p BluRay x264-ROVERS", "");
        expect(actual).toEqual({ type: "movie", movieName: "deadpool 2", movieYear: 2018 });
    });
    it("test movie name with irrelevant numbers", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("The.House.That.Jack.Built.2018.1080p.AMZN.WEB-DL.DDP5.1.H.264-NTG", "");
        expect(actual).toEqual({ type: "movie", movieName: "the house that jack built", movieYear: 2018 });
    });
    it("test calculateSimilarityMark - unknown words", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actualOneLetterMark: any = szClassifier.calculateSimilarityMark(["a"]);
        expect(actualOneLetterMark).toEqual(0.2);
        const actualTwoLetterMark: any = szClassifier.calculateSimilarityMark(["ab"]);
        expect(actualTwoLetterMark).toEqual(0.4);
        const actualSixLetterMark: any = szClassifier.calculateSimilarityMark(["abcdef"]);
        expect(actualSixLetterMark).toEqual(1);
    });
    it("test calculateSimilarityMark - known words", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const encodingMark: any = szClassifier.calculateSimilarityMark(["x264"]);
        expect(encodingMark).toEqual(ENCODING_MARK);
        const dimensionMark: any = szClassifier.calculateSimilarityMark(["720p"]);
        expect(dimensionMark).toEqual(DIMENSION_MARK);
        const ripMark: any = szClassifier.calculateSimilarityMark(["web", "dl"]);
        expect(ripMark).toEqual(RIP_MARK);
        const specialEditionMark: any = szClassifier.calculateSimilarityMark(["final", "cut"]);
        expect(specialEditionMark).toEqual(SPECIAL_EDITION_MARK);
    });
    it("test special episode name (season 00)", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("Stranger.Things.S00E01.1080p.WEB.x264-STRiFE", "");
        expect(actual).toEqual({ type: "episode", series: "stranger things", season: 0, episode: 1 });
    });
    it("test lowercase episode name", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("living.with.yourself.s01e01.internal.hdr.1080p.web.h265-paleale", "");
        expect(actual).toEqual({ type: "episode", series: "living with yourself", season: 1, episode: 1 });
    });
});
