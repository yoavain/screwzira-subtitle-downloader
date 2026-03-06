import { OllamaClient } from "~src/sync/ollamaClient";
import { MockLogger } from "~test/__mocks__";

const BASE_URL = "http://localhost:11434";

function makeResponse(status: number, body?: object): Response {
    return {
        status,
        statusText: status === 200 ? "OK" : "Error",
        json: jest.fn().mockResolvedValue(body ?? {}),
        text: jest.fn().mockResolvedValue(JSON.stringify(body ?? {}))
    } as unknown as Response;
}

describe("OllamaClient unit tests", () => {
    const logger = new MockLogger();
    let client: OllamaClient;
    let fetchSpy: jest.SpyInstance;

    beforeEach(() => {
        client = new OllamaClient(BASE_URL, logger);
        fetchSpy = jest.spyOn(global, "fetch");
    });

    afterEach(() => {
        fetchSpy.mockRestore();
    });

    describe("isReachable", () => {
        it("returns true when /api/tags responds with 200", async () => {
            fetchSpy.mockResolvedValue(makeResponse(200));
            expect(await client.isReachable()).toBe(true);
            expect(fetchSpy).toHaveBeenCalledWith(`${BASE_URL}/api/tags`);
        });

        it("returns false when /api/tags responds with non-200", async () => {
            fetchSpy.mockResolvedValue(makeResponse(500));
            expect(await client.isReachable()).toBe(false);
        });

        it("returns false when fetch throws", async () => {
            fetchSpy.mockRejectedValue(new Error("connection refused"));
            expect(await client.isReachable()).toBe(false);
        });
    });

    describe("isModelAvailable", () => {
        it("returns true when /api/show responds with 200", async () => {
            fetchSpy.mockResolvedValue(makeResponse(200));
            expect(await client.isModelAvailable("llama3")).toBe(true);
        });

        it("returns false when /api/show responds with non-200 (model not found)", async () => {
            fetchSpy.mockResolvedValue(makeResponse(404));
            expect(await client.isModelAvailable("no-such-model:99b")).toBe(false);
        });

        it("returns false when fetch throws", async () => {
            fetchSpy.mockRejectedValue(new Error("timeout"));
            expect(await client.isModelAvailable("any-model")).toBe(false);
        });
    });

    describe("chat", () => {
        it("returns message content on 200 response", async () => {
            const responseBody = { message: { content: "Hello world" } };
            fetchSpy.mockResolvedValue(makeResponse(200, responseBody));
            const result = await client.chat("llama3", [{ role: "user", content: "Hi" }]);
            expect(result).toBe("Hello world");
        });

        it("sends correct request body including stream:false", async () => {
            const responseBody = { message: { content: "ok" } };
            fetchSpy.mockResolvedValue(makeResponse(200, responseBody));
            await client.chat("llama3", [{ role: "user", content: "test" }]);

            const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
            const body = JSON.parse(init.body as string) as { model: string; stream: boolean };
            expect(body.model).toBe("llama3");
            expect(body.stream).toBe(false);
        });

        it("throws when response status is not 200", async () => {
            fetchSpy.mockResolvedValue(makeResponse(500));
            await expect(
                client.chat("llama3", [{ role: "user", content: "Hi" }])
            ).rejects.toThrow("Ollama chat request failed");
        });
    });
});
