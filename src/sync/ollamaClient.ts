import type { LoggerInterface } from "~src/logger";

export interface OllamaClientInterface {
    isReachable: () => Promise<boolean>;
    isModelAvailable: (model: string) => Promise<boolean>;
    chat: (model: string, messages: { role: string; content: string }[]) => Promise<string>;
}

export class OllamaClient implements OllamaClientInterface {
    constructor(private readonly baseUrl: string, private readonly logger: LoggerInterface) {}

    async isReachable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/tags`);
            return response.status === 200;
        }
        catch {
            return false;
        }
    }

    async isModelAvailable(model: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/api/show`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: model })
            });
            return response.status === 200;
        }
        catch {
            return false;
        }
    }

    async chat(model: string, messages: { role: string; content: string }[]): Promise<string> {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages, stream: false })
        });
        if (response.status !== 200) {
            throw new Error(`Ollama chat request failed: ${response.status} ${response.statusText}`);
        }
        const data = await response.json() as { message: { content: string } };
        this.logger.debug(`Ollama response: ${data.message.content}`);
        return data.message.content;
    }
}
