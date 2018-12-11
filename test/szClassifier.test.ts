import {ISzClassifier, SzClassifier} from "../src/szClassifier";
import {ISzConfig, SzConfig} from "../src/szConfig";
import {ISzLogger} from "../src/szLogger";

const mockLogger: ISzLogger = {
    setLogLevel() { jest.fn() },
    info() { jest.fn() },
    debug() { jest.fn() },
    verbose() { jest.fn() },
    warn() { jest.fn() },
    error() { jest.fn() }
};

const mockConfig: ISzConfig = new SzConfig("resources/screwzira-downloader-config.json", mockLogger);

describe("test classify", () => {
    it("test movie name ends with number", () => {
        const szClassifier: ISzClassifier = new SzClassifier(mockLogger, mockConfig);
        const actual: any = szClassifier.classify("Deadpool.2.2018.THEATRICAL.1080p.BluRay.x264-ROVERS", "");
        expect(actual).toEqual({ type: "movie", movieName: "deadpool 2", movieYear: 2018 });
    });
});