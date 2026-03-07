import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { SubtitleSyncer } from "~src/sync/subtitleSyncer";
import type { SyncConfig } from "~src/sync/types";
import type { EnglishSourceFinderInterface } from "~src/sync/englishSourceFinder";
import { NotificationType } from "~src/notifier";
import { MockLogger, MockNotifier } from "~test/mocks";
import { makeOllamaClient } from "~test/sync/helpers";

jest.mock("~src/sync/syncPreflightCheck");

import { syncPreflightCheck } from "~src/sync/syncPreflightCheck";
const mockPreflight = syncPreflightCheck as jest.Mock;

// SRT fixtures
const ENG_SRT = `\
1
00:00:01,000 --> 00:00:02,000
Hello

2
00:00:03,000 --> 00:00:04,000
World

3
00:00:05,000 --> 00:00:06,000
Test
`;

const HEB_SRT = `\
1
00:00:01,200 --> 00:00:02,200
שלום

2
00:00:03,200 --> 00:00:04,200
עולם

3
00:00:05,200 --> 00:00:06,200
בדיקה
`;

const SYNC_CONFIG: SyncConfig = {
    syncEnabled: true,
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "test-model",
    syncChunkThresholdSeconds: 0.3,
    syncBatchSize: 5
};

function makeEnglishFinder(result: string | null): EnglishSourceFinderInterface {
    return { findEnglishSrt: jest.fn().mockResolvedValue(result) };
}

describe("SubtitleSyncer", () => {
    const logger = new MockLogger();

    describe("returns early", () => {
        it("when preflight check fails", async () => {
            mockPreflight.mockResolvedValue(false);
            const finder = makeEnglishFinder("/some/path.eng.srt");
            const ollama = makeOllamaClient();
            const notifier = new MockNotifier();
            jest.spyOn(notifier, "notif");

            const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
            await syncer.sync("/fake/video.mkv");

            expect(finder.findEnglishSrt).not.toHaveBeenCalled();
            expect(ollama.chat).not.toHaveBeenCalled();
            expect(notifier.notif).not.toHaveBeenCalled();
        });

        it("when findEnglishSrt returns null", async () => {
            mockPreflight.mockResolvedValue(true);
            const finder = makeEnglishFinder(null);
            const ollama = makeOllamaClient();
            const notifier = new MockNotifier();
            jest.spyOn(notifier, "notif");

            const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
            await syncer.sync("/fake/video.mkv");

            expect(ollama.chat).not.toHaveBeenCalled();
            expect(notifier.notif).not.toHaveBeenCalled();
        });

        it("when Hebrew SRT file is not found on disk", async () => {
            mockPreflight.mockResolvedValue(true);
            const finder = makeEnglishFinder("/nonexistent/path.eng.srt");
            const ollama = makeOllamaClient();
            const notifier = new MockNotifier();
            jest.spyOn(notifier, "notif");

            const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
            await syncer.sync("/nonexistent/video.mkv");

            expect(ollama.chat).not.toHaveBeenCalled();
            expect(notifier.notif).not.toHaveBeenCalled();
        });

        it("when both SRT files are empty", async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-syncer-test-"));
            try {
                const engPath = path.join(tmpDir, "video.eng.srt");
                const hebPath = path.join(tmpDir, "video.heb.srt");
                fs.writeFileSync(engPath, "");
                fs.writeFileSync(hebPath, "");

                mockPreflight.mockResolvedValue(true);
                const finder = makeEnglishFinder(engPath);
                const ollama = makeOllamaClient();
                const notifier = new MockNotifier();
                const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
                await syncer.sync(path.join(tmpDir, "video.mkv"));

                expect(ollama.chat).not.toHaveBeenCalled();
                expect(notifier.notif).not.toHaveBeenCalled();
            }
            finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        it("when LLM returns no matches", async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-syncer-test-"));
            try {
                const engPath = path.join(tmpDir, "video.eng.srt");
                const hebPath = path.join(tmpDir, "video.heb.srt");
                fs.writeFileSync(engPath, ENG_SRT);
                fs.writeFileSync(hebPath, HEB_SRT);

                mockPreflight.mockResolvedValue(true);
                const finder = makeEnglishFinder(engPath);
                const ollama = makeOllamaClient(() => Promise.resolve("[]"));
                const notifier = new MockNotifier();
                const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
                await syncer.sync(path.join(tmpDir, "video.mkv"));

                expect(notifier.notif).not.toHaveBeenCalled();
                expect(fs.existsSync(`${hebPath}.bak`)).toBe(false);
            }
            finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });

    describe("happy path", () => {
        it("writes corrected .srt, creates .bak, and calls notifier", async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-syncer-test-"));
            try {
                const engPath = path.join(tmpDir, "video.eng.srt");
                const hebPath = path.join(tmpDir, "video.heb.srt");
                fs.writeFileSync(engPath, ENG_SRT);
                fs.writeFileSync(hebPath, HEB_SRT);

                // LLM returns 1:1 matches for all 3 entries
                const llmResponse = JSON.stringify([
                    { heb: [0], eng: [0] },
                    { heb: [1], eng: [1] },
                    { heb: [2], eng: [2] }
                ]);
                mockPreflight.mockResolvedValue(true);
                const finder = makeEnglishFinder(engPath);
                const ollama = makeOllamaClient(() => Promise.resolve(llmResponse));
                const notifier = new MockNotifier();
                const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
                await syncer.sync(path.join(tmpDir, "video.mkv"));

                expect(fs.existsSync(hebPath)).toBe(true);
                expect(fs.existsSync(`${hebPath}.bak`)).toBe(true);
                expect(notifier.notif).toHaveBeenCalledWith(
                    expect.any(String),
                    NotificationType.DOWNLOAD
                );

                // Corrected SRT should have 3 entries
                const correctedContent = fs.readFileSync(hebPath, "utf-8");
                expect(correctedContent).toContain("-->");
                const lineCount = correctedContent.split("-->").length - 1;
                expect(lineCount).toBe(3);
            }
            finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });

        it("still writes corrected SRT and calls notifier when backup copy fails", async () => {
            const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ktuvit-syncer-test-"));
            try {
                const engPath = path.join(tmpDir, "video.eng.srt");
                const hebPath = path.join(tmpDir, "video.heb.srt");
                fs.writeFileSync(engPath, ENG_SRT);
                fs.writeFileSync(hebPath, HEB_SRT);

                // Create a directory at the .bak path so copyFileSync fails naturally
                const bakPath = `${hebPath}.bak`;
                fs.mkdirSync(bakPath);

                const llmResponse = JSON.stringify([
                    { heb: [0], eng: [0] },
                    { heb: [1], eng: [1] },
                    { heb: [2], eng: [2] }
                ]);
                mockPreflight.mockResolvedValue(true);
                const finder = makeEnglishFinder(engPath);
                const ollama = makeOllamaClient(() => Promise.resolve(llmResponse));
                const notifier = new MockNotifier();
                const syncer = new SubtitleSyncer(SYNC_CONFIG, "heb.srt", ollama, finder, logger, notifier);
                await syncer.sync(path.join(tmpDir, "video.mkv"));

                // Backup failed but corrected SRT is still written
                expect(fs.existsSync(hebPath)).toBe(true);
                expect(notifier.notif).toHaveBeenCalled();
            }
            finally {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        });
    });
});
