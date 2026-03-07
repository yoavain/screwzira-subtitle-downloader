import * as fs from "node:fs";
import * as os from "node:os";
import path from "node:path";
import type { ConfigInterface } from "~src/config";
import { Config } from "~src/config";
import type { LoggerInterface } from "~src/logger";
import { MockLogger } from "~test/mocks";

const CONFIG_FILE: string = path.resolve(__dirname, "resources", "config", "test-config.json");
//C:\Dev\_MISC\screwzira-subtitle-downloader\test\resources\config\test-config.json

describe("Test config class", () => {
    it("Should read config file correctly", () => {
        const logger: LoggerInterface = new MockLogger();
        const config: ConfigInterface = new Config(CONFIG_FILE, logger);

        expect(config.getLanguageCode()).toBe("heb");
        expect(config.getLogLevel()).toBe("debug");
        expect(config.getExtensions()).toEqual(["mkv", "mp4", "avi"]);
        expect(config.replaceTitleIfNeeded("poker face 2023")).toBe("poker face");
    });
});

// Shared config for all read-only tests against CONFIG_FILE
let config: ConfigInterface;
beforeAll(() => {
    config = new Config(CONFIG_FILE, new MockLogger());
});

describe("Test replaceTitleIfNeeded", () => {
    it("Should return replacement for exact lowercase match", () => {
        expect(config.replaceTitleIfNeeded("poker face 2023")).toBe("poker face");
    });

    it("Should return replacement for case-insensitive match", () => {
        // Key "Yellowjackets (2021)" is stored lowercase; input with mixed case should still match
        expect(config.replaceTitleIfNeeded("Yellowjackets (2021)")).toBe("Yellowjackets");
    });

    it("Should return original text when no match", () => {
        expect(config.replaceTitleIfNeeded("breaking bad 2008")).toBe("breaking bad 2008");
    });
});

describe("Test sync-related config methods", () => {
    it("getSubtitlesSuffix() returns languageCode + '.srt'", () => {
        expect(config.getSubtitlesSuffix()).toBe("heb.srt");
    });

    it("getSyncConfig() returns object with correct shape and default values", () => {
        const syncConfig = config.getSyncConfig();
        expect(syncConfig).toEqual({
            syncEnabled: false,
            ollamaBaseUrl: "",
            ollamaModel: "translategemma:12b",
            syncChunkThresholdSeconds: 0.3,
            syncBatchSize: 20
        });
    });

    it("getCheckEmbeddedSubtitles() returns false when field is absent from config", () => {
        expect(config.getCheckEmbeddedSubtitles()).toBe(false);
    });
});

describe("Config edge cases", () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-config-test-"));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it("creates config file with defaults when it does not exist", () => {
        const newConfig = path.join(tmpDir, "new-config.json");
        const c = new Config(newConfig, new MockLogger());
        expect(fs.existsSync(newConfig)).toBe(true);
        expect(c.getLogLevel()).toBe("debug"); // default value
    });

    it("uses default config when config file is corrupted JSON", () => {
        const corruptFile = path.join(tmpDir, "corrupt.json");
        fs.writeFileSync(corruptFile, "{ invalid json !!!");
        const logger = new MockLogger();
        const errorSpy = jest.spyOn(logger, "error");
        const c = new Config(corruptFile, logger);
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("corrupted"));
        expect(c.getLanguageCode()).toBe("Hebrew"); // default value
    });
});