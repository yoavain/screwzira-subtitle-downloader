import { ISzArgsParser, SzArgsParser } from "../src/szArgsParser";

const SONARR = 'sonarr';
const INPUT = 'input';
const QUIET = 'quiet';
const SONARR_EPISODE_FILE_PATH = 'sonarr_episodefile_path';

const NODE = "node.exe";
const SCRIPT = "index.js";
const RUNTIME = "screwzira-downloader.exe";
const MKV = "some-file.mkv";

describe("test parse", () => {
    beforeAll(() => {
        process.env[SONARR_EPISODE_FILE_PATH] = MKV;
    });

    it("test legacy", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([NODE, SCRIPT, MKV]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(false);
    });
    it("test legacy - runtime", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, MKV]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(false);

    });
    it("test input", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([NODE, SCRIPT, INPUT, MKV]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(false);
    });
    it("test input - runtime", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, INPUT, MKV]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(false);
    });
    it("test input quiet", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([NODE, SCRIPT, INPUT, MKV, QUIET]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(true);
        expect(szArgsParser.isSonarrMode()).toEqual(false);
    });
    it("test input quiet - runtime", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, INPUT, MKV, QUIET]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(true);
        expect(szArgsParser.isSonarrMode()).toEqual(false);
    });
    it("test sonarr", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([NODE, SCRIPT, SONARR]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr - runtime", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, SONARR]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(false);
        expect(szArgsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr quiet", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([NODE, SCRIPT, SONARR, QUIET]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(true);
        expect(szArgsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr quiet - runtime", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, SONARR, QUIET]);
        expect(szArgsParser.getInput()).toEqual(MKV);
        expect(szArgsParser.isQuiet()).toEqual(true);
        expect(szArgsParser.isSonarrMode()).toEqual(true);
    });

    it("test error - no args", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME]);
        expect(szArgsParser.getInput()).toBe(undefined);
    });
    it("test error - only quiet", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, QUIET]);
        expect(szArgsParser.getInput()).toBe(undefined);
    });
    it("test error - only input", () => {
        const szArgsParser: ISzArgsParser = new SzArgsParser([RUNTIME, INPUT]);
        expect(szArgsParser.getInput()).toBe(undefined);
    });
});
