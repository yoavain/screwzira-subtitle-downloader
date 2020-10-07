import type { ArgsParserInterface } from "~src/argsParser";
import { ArgsParser } from "~src/argsParser";

const SONARR = "sonarr";
const INPUT = "input";
const QUIET = "quiet";
const SONARR_EPISODE_FILE_PATH = "sonarr_episodefile_path";

const NODE = "node.exe";
const SCRIPT = "index.js";
const RUNTIME = "ktuvit-downloader.exe";
const MKV = "some-file.mkv";

describe("test parse", () => {
    beforeAll(() => {
        process.env[SONARR_EPISODE_FILE_PATH] = MKV;
    });

    it("test legacy", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([NODE, SCRIPT, MKV]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test legacy - runtime", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, MKV]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test input", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([NODE, SCRIPT, INPUT, MKV]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test input - runtime", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, INPUT, MKV]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test input quiet", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([NODE, SCRIPT, INPUT, MKV, QUIET]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(true);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test input quiet - runtime", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, INPUT, MKV, QUIET]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(true);
        expect(argsParser.isSonarrMode()).toEqual(false);
    });
    it("test sonarr", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([NODE, SCRIPT, SONARR]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr - runtime", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, SONARR]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(false);
        expect(argsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr quiet", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([NODE, SCRIPT, SONARR, QUIET]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(true);
        expect(argsParser.isSonarrMode()).toEqual(true);
    });
    it("test sonarr quiet - runtime", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, SONARR, QUIET]);
        expect(argsParser.getInput()).toEqual(MKV);
        expect(argsParser.isQuiet()).toEqual(true);
        expect(argsParser.isSonarrMode()).toEqual(true);
    });

    it("test error - no args", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME]);
        expect(argsParser.getInput()).toBe(undefined);
    });
    it("test error - only quiet", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, QUIET]);
        expect(argsParser.getInput()).toBe(undefined);
    });
    it("test error - only input", () => {
        const argsParser: ArgsParserInterface = new ArgsParser([RUNTIME, INPUT]);
        expect(argsParser.getInput()).toBe(undefined);
    });
});
