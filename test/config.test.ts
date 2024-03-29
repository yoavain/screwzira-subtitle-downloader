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