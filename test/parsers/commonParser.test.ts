import type { ClassifierInterface } from "~src/classifier";
import { Classifier } from "~src/classifier";
import type { Subtitle } from "~src/parsers/commonParser";
import { CommonParser } from "~src/parsers/commonParser";
import { MockConfig, MockLogger, MockNotifier } from "~test/__mocks__";
import type { LoggerInterface } from "~src/logger";
import type { NotifierInterface } from "~src/notifier";
import type { ConfigInterface } from "~src/config";

// Subclass to expose protected methods for testing
class TestParser extends CommonParser {
    public callHandleError(error: string, response: Response | null) {
        return this.handleError(error, response);
    }
    public callFetchWithRetry(url: string, init: RequestInit, retries?: number) {
        return this.fetchWithRetry(url, init, retries);
    }
}

describe("Test CommonParser", () => {
    it("Test findClosestMatch", () => {
        const logger: LoggerInterface = new MockLogger();
        const notifier: NotifierInterface = new MockNotifier();
        const config: ConfigInterface = new MockConfig();

        // File classifier
        const classifier: ClassifierInterface = new Classifier(logger, config);

        const commonParser: CommonParser = new CommonParser(logger, notifier, classifier);

        const filenameNoExtension = "Frozen.2013.1080p.BluRay.x264-HebDub";
        const subtitles: Subtitle[] = [
            { name: "Frozen.2013.1080p.BluRay.x264-SPARKS", id: "E00664CE8F1C1D95D55CC21E85C1A031" },
            { name: "Frozen.2013.2160p.UHD.Bluray.x265-Aviator.srt", id: "8B8AF1119319F258900BD7FF7A92EE5A" },
            { name: "Frozen.2013.1080p.BluRay.H264.AAC-RARBG", id: "4BC6EC91ADEAA0A46AA5E0954BED3347" },
            { name: "Frozen.2013.720p.BluRay.x264-SPARKS", id: "317670E777F61C4AD2B71E9714A2C5AB" },
            { name: "Frozen.2013.720p.BluRay.x264.YIFY", id: "316C38680D0F36489DA0C742E8F18F4A" },
            { name: "Frozen.2013.720p.BluRay.H264.AAC-RARBG", id: "A31031B5FB5E289E00B59503C61492D9" },
            { name: "Frozen.2013.1080p.Bluray.HEVC.x265.AAC.5.1-GIRAYS", id: "B38789342D9D6377AD83F027F30233DD" },
            { name: "Frozen.2013.1080p.BluRay.H264.AAC-RARBG", id: "21263F4C6A84339B6B74148D35AC57F0" },
            { name: "Frozen.2013.720p.BluRay.x264.YIFY", id: "A74371FF3C880EC1A1E2824C70B29FF2" },
            { name: "Frozen.2013.720p.BluRay.H264.AAC-RARBG", id: "950B139B3B6BD5C20CE0B90F0A73555F" },
            { name: "Frozen.2013.720p.BluRay.x264-SPARKS", id: "8C320E2C5A5E26CB47F050195912E6FB" },
            { name: "Frozen.2013.1080p.BRRip.x264-YIFY", id: "F7B22B89894B2AB7E0D3BADA8263FAEE" },
            { name: "Frozen.2013.1080p.BluRay.x264-SPARKS", id: "8AAF8BD11EF634A60A574603CD8083B1" }
        ];
        const excludeList: string[] = ["frozen", "2013"];
        const closestMatch = commonParser.findClosestMatch(filenameNoExtension, subtitles, excludeList);
        expect(closestMatch).toBe("E00664CE8F1C1D95D55CC21E85C1A031");
    });

    it("findClosestMatch returns undefined for empty subtitles array", () => {
        const logger = new MockLogger();
        const notifier = new MockNotifier();
        const config = new MockConfig();
        const classifier = new Classifier(logger, config);
        const commonParser = new CommonParser(logger, notifier, classifier);
        const result = commonParser.findClosestMatch("some-file", [], []);
        expect(result).toBeUndefined();
    });
});

describe("CommonParser protected methods", () => {
    const logger = new MockLogger();
    const notifier = new MockNotifier();
    const config = new MockConfig();
    const classifier = new Classifier(logger, config);
    let parser: TestParser;
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        parser = new TestParser(logger, notifier, classifier);
        fetchSpy = jest.spyOn(global, "fetch");
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    describe("handleError", () => {
        it("logs only error message when response is null", async () => {
            const errorSpy = jest.spyOn(logger, "error");
            await parser.callHandleError("test error", null);
            expect(errorSpy).toHaveBeenCalledWith("test error");
            expect(errorSpy).toHaveBeenCalledTimes(1);
        });

        it("logs error message and response body when response is provided", async () => {
            const errorSpy = jest.spyOn(logger, "error");
            const mockResponse = {
                text: jest.fn().mockResolvedValue("error body text")
            } as unknown as Response;
            await parser.callHandleError("request failed", mockResponse);
            expect(errorSpy).toHaveBeenCalledWith("request failed");
            expect(errorSpy).toHaveBeenCalledWith("error body text");
        });

        it("logs warn when response.text() throws", async () => {
            const warnSpy = jest.spyOn(logger, "warn");
            const mockResponse = {
                text: jest.fn().mockRejectedValue(new Error("parse fail"))
            } as unknown as Response;
            await parser.callHandleError("request failed", mockResponse);
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse error response"));
        });
    });

    describe("fetchWithRetry", () => {
        it("returns response on first successful fetch", async () => {
            const mockResponse = { status: 200 } as Response;
            fetchSpy.mockResolvedValue(mockResponse);
            const result = await parser.callFetchWithRetry("http://test.com", {}, 0);
            expect(result).toBe(mockResponse);
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });

        it("retries and returns response after one failure", async () => {
            jest.useFakeTimers();
            const mockResponse = { status: 200 } as Response;
            fetchSpy
                .mockRejectedValueOnce(new Error("timeout"))
                .mockResolvedValueOnce(mockResponse);

            const promise = parser.callFetchWithRetry("http://test.com", {}, 1);
            await jest.advanceTimersByTimeAsync(2000);
            const result = await promise;

            expect(result).toBe(mockResponse);
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            jest.useRealTimers();
        });

        it("throws immediately when retries=0 and fetch fails", async () => {
            const err = new Error("always fails");
            fetchSpy.mockRejectedValue(err);
            await expect(
                parser.callFetchWithRetry("http://test.com", {}, 0)
            ).rejects.toThrow("always fails");
            expect(fetchSpy).toHaveBeenCalledTimes(1);
        });
    });
});