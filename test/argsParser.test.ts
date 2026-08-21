import * as path from "node:path";
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

    it("isSync() returns false by default", () => {
        const argsParser = new ArgsParser([NODE, SCRIPT, INPUT, MKV]);
        expect(argsParser.isSync()).toBe(false);
    });

    it("isSync() returns true when 'sync' is in argv", () => {
        const argsParser = new ArgsParser([NODE, SCRIPT, INPUT, MKV, "sync"]);
        expect(argsParser.isSync()).toBe(true);
    });

    it("getMkvtoolnixDir() returns a path ending in mkvtoolnix", () => {
        const argsParser = new ArgsParser([NODE, SCRIPT, INPUT, MKV]);
        expect(argsParser.getMkvtoolnixDir()).toContain("mkvtoolnix");
    });

    it("getSnoreToastPath() returns null for non-installed exe", () => {
        const argsParser = new ArgsParser([NODE, SCRIPT, INPUT, MKV]);
        expect(argsParser.getSnoreToastPath()).toBeNull();
    });

    it("getSnoreToastPath() returns path for installed exe", () => {
        const argsParser = new ArgsParser(["ktuvit-downloader.exe", INPUT, MKV]);
        expect(argsParser.getSnoreToastPath()).toContain("snoretoast-x64.exe");
    });

    it("getHelp() returns a string with option descriptions", () => {
        const argsParser = new ArgsParser([NODE, SCRIPT, INPUT, MKV]);
        const help = argsParser.getHelp();
        expect(typeof help).toBe("string");
        expect(help).toContain("input");
        expect(help).toContain("sonarr");
        expect(help).toContain("quiet");
        expect(help).toContain("sync");
    });
});
