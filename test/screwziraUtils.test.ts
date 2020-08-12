// Mock first
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
const mockFsWriteFileSync = jest.fn((destination, response) => {
    console.log(`Writing file: ${destination} with ${response.size} bytes`);
});
fs.writeFileSync = mockFsWriteFileSync;

import * as path from "path";
import { IScrewziraUtils, ScrewziraUtils } from "~src/screwziraUtils";
import { ISzClassifier, SzClassifier } from "~src/szClassifier";
import { ISzLogger } from "~src/szLogger";
import { ISzNotifier } from "~src/szNotifier";
import { ISzConfig } from "~src/szConfig";

describe("Test screwziraUtils", () => {
    it("Test fetch file", async () => {
        // Logger
        const szLogger: ISzLogger = {
            debug: (message: string) => () => console.log(`Notification: ${message}`),
            error: (message: string) => () => console.log(`Notification: ${message}`),
            info: (message: string) => () => console.log(`Notification: ${message}`),
            verbose: (message: string) => () => console.log(`Notification: ${message}`),
            warn: (message: string) => () => console.log(`Notification: ${message}`),
            setLogLevel: () => null
        };

        // Notifier
        const szNotifier: ISzNotifier = {
            notif: (message: string) => {
                console.log(`Notification: ${message}`);
            }
        };

        // Config
        const szConfig: ISzConfig = {
            getExtensions: () => [],
            getLogLevel: () => "",
            replaceTitleIfNeeded: () => ""
        };

        // File classifier
        const szClassifier: ISzClassifier = new SzClassifier(szLogger, szConfig);

        // Screwzira Utils
        const screwziraUtils: IScrewziraUtils = new ScrewziraUtils(szLogger, szNotifier, szClassifier);

        await screwziraUtils.handleMovie("Frozen", 2013, "Frozen.2013.1080p.BluRay.x264-HebDub", ".");
        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        expect(fs.writeFileSync.mock.calls[0][0]).toEqual(path.join(__dirname, "..", "Frozen.2013.1080p.BluRay.x264-HebDub.Hebrew.srt"));
        expect(fs.writeFileSync.mock.calls[0][1].length).toBeGreaterThan(0);
    });
});