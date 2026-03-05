/**
 * Integration test for OllamaClient — hits a real Ollama instance.
 *
 * Skipped by default. To run locally:
 *   OLLAMA_INTEGRATION=1 npx jest test/sync/ollamaClient.integration.test.ts
 *
 * Optional overrides via environment variables:
 *   OLLAMA_BASE_URL   — defaults to http://localhost:11434
 *   OLLAMA_MODEL      — defaults to translategemma:12b
 */

import { OllamaClient } from "~src/sync/ollamaClient";
import { MockLogger } from "~test/__mocks__";

const RUN = process.env["OLLAMA_INTEGRATION"] === "1";
const BASE_URL = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
const MODEL = process.env["OLLAMA_MODEL"] ?? "translategemma:12b";

if (RUN) jest.setTimeout(120_000);

const describeOrSkip = RUN ? describe : describe.skip;

describeOrSkip("OllamaClient integration (real Ollama)", () => {
    let client: OllamaClient;
    const logger = new MockLogger();

    beforeAll(async () => {
        client = new OllamaClient(BASE_URL, logger);
        const reachable = await client.isReachable();
        if (!reachable) {
            throw new Error(`Ollama is not reachable at ${BASE_URL}. Is it running?`);
        }
    });

    it("isReachable returns true when Ollama is running", async () => {
        const result = await client.isReachable();
        expect(result).toBe(true);
    });

    it("isModelAvailable returns true for an installed model", async () => {
        const result = await client.isModelAvailable(MODEL);
        expect(result).toBe(true);
    });

    it("isModelAvailable returns false for a non-existent model", async () => {
        const result = await client.isModelAvailable("this-model-does-not-exist:99b");
        expect(result).toBe(false);
    });

    it("chat returns a non-empty string response", async () => {
        const response = await client.chat(MODEL, [
            { role: "user", content: "Reply with exactly one word: hello" }
        ]);
        expect(typeof response).toBe("string");
        expect(response.trim().length).toBeGreaterThan(0);
    });

    it("chat throws on a bad model name", async () => {
        await expect(
            client.chat("this-model-does-not-exist:99b", [
                { role: "user", content: "hello" }
            ])
        ).rejects.toThrow("Ollama chat request failed");
    });
});
