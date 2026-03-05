import { syncPreflightCheck } from "~src/sync/syncPreflightCheck";
import type { SyncConfig } from "~src/sync/types";
import type { OllamaClientInterface } from "~src/sync/ollamaClient";
import { MockLogger } from "~test/__mocks__";

function makeMockOllama(reachable: boolean, modelAvailable: boolean): OllamaClientInterface {
    return {
        isReachable: jest.fn().mockResolvedValue(reachable),
        isModelAvailable: jest.fn().mockResolvedValue(modelAvailable),
        chat: jest.fn()
    };
}

const baseConfig: SyncConfig = {
    syncEnabled: true,
    ollamaBaseUrl: "http://localhost:11434",
    ollamaModel: "translategemma:12b",
    syncChunkThresholdSeconds: 0.3,
    syncBatchSize: 20
};

describe("syncPreflightCheck", () => {
    const logger = new MockLogger();

    it("returns false silently when syncEnabled is false", async () => {
        const config: SyncConfig = { ...baseConfig, syncEnabled: false };
        const ollama = makeMockOllama(true, true);
        const result = await syncPreflightCheck(config, ollama, logger);
        expect(result).toBe(false);
        expect(ollama.isReachable).not.toHaveBeenCalled();
    });

    it("returns false when ollamaBaseUrl is empty", async () => {
        const config: SyncConfig = { ...baseConfig, ollamaBaseUrl: "" };
        const ollama = makeMockOllama(true, true);
        const result = await syncPreflightCheck(config, ollama, logger);
        expect(result).toBe(false);
        expect(ollama.isReachable).not.toHaveBeenCalled();
    });

    it("returns false when Ollama is not reachable", async () => {
        const ollama = makeMockOllama(false, true);
        const result = await syncPreflightCheck(baseConfig, ollama, logger);
        expect(result).toBe(false);
        expect(ollama.isModelAvailable).not.toHaveBeenCalled();
    });

    it("returns false when model is not available", async () => {
        const ollama = makeMockOllama(true, false);
        const result = await syncPreflightCheck(baseConfig, ollama, logger);
        expect(result).toBe(false);
    });

    it("returns true when all checks pass", async () => {
        const ollama = makeMockOllama(true, true);
        const result = await syncPreflightCheck(baseConfig, ollama, logger);
        expect(result).toBe(true);
    });
});
