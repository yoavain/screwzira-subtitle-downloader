import path from "path";
import type { ConfigInterface } from "~src/config";
import { Config } from "~src/config";
import type { LoggerInterface } from "~src/logger";
import { MockLogger } from "~test/__mocks__";

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

describe("Test replaceTitleIfNeeded", () => {
    let config: ConfigInterface;

    beforeEach(() => {
        config = new Config(CONFIG_FILE, new MockLogger());
    });

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