import type { OllamaClientInterface } from "~src/sync/ollamaClient";

export function makeOllamaClient(chatImpl?: (...args: unknown[]) => Promise<string>): OllamaClientInterface {
    return {
        isReachable: jest.fn(),
        isModelAvailable: jest.fn(),
        chat: jest.fn().mockImplementation(chatImpl ?? (() => Promise.resolve("[]")))
    };
}
