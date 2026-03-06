import { SubtitleMatcher } from "~src/sync/subtitleMatcher";
import type { SubtitleEntry } from "~src/sync/types";
import { MockLogger } from "~test/__mocks__";
import { makeOllamaClient } from "~test/sync/helpers";

function makeEntry(index: number, start: number, end: number, text = "line"): SubtitleEntry {
    return { index, start, end, text };
}

const MODEL = "test-model";
const logger = new MockLogger();

describe("SubtitleMatcher", () => {
    describe("match() — single batch", () => {
        it("returns correct MatchEntry[] with absolute indices and offset", async () => {
            const heb = [makeEntry(1, 1000, 2000, "שלום"), makeEntry(2, 3000, 4000, "עולם")];
            const eng = [makeEntry(1, 1200, 2200, "Hello"), makeEntry(2, 3200, 4200, "World")];
            const response = JSON.stringify([{ heb: [0], eng: [0] }, { heb: [1], eng: [1] }]);

            const chat = jest.fn().mockResolvedValue(response);
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(matches).toHaveLength(2);
            expect(matches[0]).toEqual({
                hebrewIndices: [0],
                englishIndices: [0],
                offset: (1200 + 2200) / 2 - (1000 + 2000) / 2  // 1700 - 1500 = 200
            });
            expect(matches[1]).toEqual({
                hebrewIndices: [1],
                englishIndices: [1],
                offset: (3200 + 4200) / 2 - (3000 + 4000) / 2  // 3700 - 3500 = 200
            });
        });
    });

    describe("match() — multiple batches", () => {
        it("correctly offsets indices per batch", async () => {
            const heb = [
                makeEntry(1, 1000, 2000),
                makeEntry(2, 3000, 4000),
                makeEntry(3, 5000, 6000),
                makeEntry(4, 7000, 8000)
            ];
            const eng = [
                makeEntry(1, 1100, 2100),
                makeEntry(2, 3100, 4100),
                makeEntry(3, 5100, 6100),
                makeEntry(4, 7100, 8100)
            ];
            const batchResponse = JSON.stringify([{ heb: [0], eng: [0] }, { heb: [1], eng: [1] }]);
            const chat = jest.fn().mockResolvedValue(batchResponse);
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 2, logger);

            const matches = await matcher.match(heb, eng);

            expect(matches).toHaveLength(4);
            // Batch 0: heb[0,1] → absolute indices 0,1
            expect(matches[0].hebrewIndices).toEqual([0]);
            expect(matches[1].hebrewIndices).toEqual([1]);
            // Batch 1: heb[2,3] → LLM returns relative [0],[1] → absolute 2,3
            expect(matches[2].hebrewIndices).toEqual([2]);
            expect(matches[3].hebrewIndices).toEqual([3]);
            expect(matches[2].englishIndices).toEqual([2]);
            expect(matches[3].englishIndices).toEqual([3]);
        });

        it("stops early when a batch is empty", async () => {
            // 3 heb entries, 2 eng entries with batchSize=2:
            // numBatches = max(ceil(3/2), ceil(2/2)) = max(2,1) = 2
            // Batch 1: heb[2..3] has 1 entry, eng[2..3] is empty → break
            const heb = [makeEntry(1, 0, 1000), makeEntry(2, 2000, 3000), makeEntry(3, 4000, 5000)];
            const eng = [makeEntry(1, 0, 1000), makeEntry(2, 2000, 3000)];
            const chat = jest.fn().mockResolvedValue(JSON.stringify([{ heb: [0], eng: [0] }, { heb: [1], eng: [1] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 2, logger);

            const matches = await matcher.match(heb, eng);

            // Only batch 0 runs (batch 1 has empty engBatch → breaks)
            expect(chat).toHaveBeenCalledTimes(1);
            expect(matches).toHaveLength(2);
        });
    });

    describe("matchBatch() — error handling", () => {
        it("retries once on LLM failure and returns matches on second attempt", async () => {
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn()
                .mockRejectedValueOnce(new Error("network error"))
                .mockResolvedValueOnce(JSON.stringify([{ heb: [0], eng: [0] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(chat).toHaveBeenCalledTimes(2);
            expect(matches).toHaveLength(1);
        });

        it("returns [] for the batch after two consecutive LLM failures", async () => {
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn().mockRejectedValue(new Error("always fails"));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(chat).toHaveBeenCalledTimes(2);
            expect(matches).toEqual([]);
        });

        it("uses String(e) when first LLM call throws a non-Error value", async () => {
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn()
                .mockRejectedValueOnce("non-error string")
                .mockResolvedValueOnce(JSON.stringify([{ heb: [0], eng: [0] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(chat).toHaveBeenCalledTimes(2);
            expect(matches).toHaveLength(1);
        });

        it("uses String(e2) when retry LLM call throws a non-Error value", async () => {
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn()
                .mockRejectedValueOnce(new Error("first fail"))
                .mockRejectedValueOnce("non-error retry");
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(chat).toHaveBeenCalledTimes(2);
            expect(matches).toEqual([]);
        });

        it("returns [] when LLM response contains no parseable JSON array", async () => {
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn().mockResolvedValue("Sorry, I cannot help with that.");
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(matches).toEqual([]);
        });
    });

    describe("buildPrompt — formatting tag stripping", () => {
        it("sends text with <i>/<b> tags stripped to the LLM", async () => {
            const heb = [makeEntry(1, 0, 1000, "<i>שלום</i>")];
            const eng = [makeEntry(1, 0, 1000, "<b>Hello</b>")];
            const chat = jest.fn().mockResolvedValue(JSON.stringify([{ heb: [0], eng: [0] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            await matcher.match(heb, eng);

            const prompt: string = (chat.mock.calls[0] as [string, { role: string; content: string }[]])[1][0].content;
            expect(prompt).toContain("שלום");
            expect(prompt).not.toContain("<i>");
            expect(prompt).toContain("Hello");
            expect(prompt).not.toContain("<b>");
        });
    });

    describe("computeOffset — midpoint arithmetic", () => {
        it("computes offset as engMidpoint - hebMidpoint", async () => {
            // heb: start=0, end=2000 → midpoint=1000
            // eng: start=1500, end=3500 → midpoint=2500
            // expected offset = 2500 - 1000 = 1500
            const heb = [makeEntry(1, 0, 2000)];
            const eng = [makeEntry(1, 1500, 3500)];
            const chat = jest.fn().mockResolvedValue(JSON.stringify([{ heb: [0], eng: [0] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            expect(matches[0].offset).toBe(1500);
        });

        it("returns offset=0 when LLM references out-of-bounds indices (empty spans)", async () => {
            // LLM returns index 5 but batch only has 1 entry → filter(Boolean) = []
            const heb = [makeEntry(1, 0, 1000)];
            const eng = [makeEntry(1, 0, 1000)];
            const chat = jest.fn().mockResolvedValue(JSON.stringify([{ heb: [5], eng: [5] }]));
            const matcher = new SubtitleMatcher(makeOllamaClient(chat), MODEL, 5, logger);

            const matches = await matcher.match(heb, eng);

            // Match is produced (indices are filtered but still in result), offset should be 0
            expect(matches[0].offset).toBe(0);
        });
    });
});
