import type { SubtitleEntry, MatchEntry } from "~src/sync/types";
import type { OllamaClientInterface } from "~src/sync/ollamaClient";
import { stripFormattingTags } from "~src/sync/subtitleParser";
import type { LoggerInterface } from "~src/logger";

export class SubtitleMatcher {
    constructor(
        private readonly ollamaClient: OllamaClientInterface,
        private readonly model: string,
        private readonly batchSize: number,
        private readonly logger: LoggerInterface
    ) {}

    async match(hebEntries: SubtitleEntry[], engEntries: SubtitleEntry[]): Promise<MatchEntry[]> {
        const allMatches: MatchEntry[] = [];
        const numBatches = Math.max(
            Math.ceil(hebEntries.length / this.batchSize),
            Math.ceil(engEntries.length / this.batchSize)
        );

        for (let b = 0; b < numBatches; b++) {
            const hebStart = b * this.batchSize;
            const engStart = b * this.batchSize;
            const hebBatch = hebEntries.slice(hebStart, hebStart + this.batchSize);
            const engBatch = engEntries.slice(engStart, engStart + this.batchSize);

            if (hebBatch.length === 0 || engBatch.length === 0) {
                break;
            }

            const batchMatches = await this.matchBatch(hebBatch, engBatch, hebStart, engStart);
            allMatches.push(...batchMatches);
        }

        return allMatches;
    }

    private async matchBatch(
        hebBatch: SubtitleEntry[],
        engBatch: SubtitleEntry[],
        hebOffset: number,
        engOffset: number
    ): Promise<MatchEntry[]> {
        const prompt = this.buildPrompt(hebBatch, engBatch);

        let result: string;
        try {
            result = await this.ollamaClient.chat(this.model, [{ role: "user", content: prompt }]);
        }
        catch (e) {
            this.logger.warn(`Sync: LLM batch failed: ${e instanceof Error ? e.message : String(e)}. Retrying once.`);
            try {
                result = await this.ollamaClient.chat(this.model, [{ role: "user", content: prompt }]);
            }
            catch (e2) {
                this.logger.warn(`Sync: LLM batch retry failed: ${e2 instanceof Error ? e2.message : String(e2)}. Keeping original timing for this batch.`);
                return [];
            }
        }

        let parsed: { heb: number[]; eng: number[] }[];
        try {
            parsed = this.parseResponse(result);
        }
        catch {
            this.logger.warn("Sync: Failed to parse LLM response for batch. Keeping original timing.");
            return [];
        }

        return parsed
            .filter((entry) => entry.heb?.length > 0 && entry.eng?.length > 0)
            .map((entry) => {
                const absHebIndices = entry.heb.map((i) => i + hebOffset);
                const absEngIndices = entry.eng.map((i) => i + engOffset);
                const offset = this.computeOffset(hebBatch, engBatch, entry.heb, entry.eng);
                return { hebrewIndices: absHebIndices, englishIndices: absEngIndices, offset };
            });
    }

    private computeOffset(
        hebBatch: SubtitleEntry[],
        engBatch: SubtitleEntry[],
        hebRelIndices: number[],
        engRelIndices: number[]
    ): number {
        const hebSpan = hebRelIndices.map((i) => hebBatch[i]).filter(Boolean);
        const engSpan = engRelIndices.map((i) => engBatch[i]).filter(Boolean);
        if (!hebSpan.length || !engSpan.length) {
            return 0;
        }
        const hebMidpoint = (Math.min(...hebSpan.map((e) => e.start)) + Math.max(...hebSpan.map((e) => e.end))) / 2;
        const engMidpoint = (Math.min(...engSpan.map((e) => e.start)) + Math.max(...engSpan.map((e) => e.end))) / 2;
        return engMidpoint - hebMidpoint;
    }

    private buildPrompt(hebBatch: SubtitleEntry[], engBatch: SubtitleEntry[]): string {
        const hebLines = hebBatch.map((e, i) => `[${i}] "${stripFormattingTags(e.text)}"`).join("\n");
        const engLines = engBatch.map((e, i) => `[${i}] "${stripFormattingTags(e.text)}"`).join("\n");

        return `You are a subtitle alignment assistant.
Given the following Hebrew subtitle lines and English subtitle lines from the same video scene,
produce a JSON array of matches. Each match maps one or more Hebrew line indices to one or more
English line indices. Handle cases where one Hebrew line corresponds to multiple English lines
(split) or multiple Hebrew lines correspond to one English line (merge).

Hebrew lines:
${hebLines}

English lines:
${engLines}

Respond ONLY with valid JSON. Format: [{"heb": [number], "eng": [number]}]`;
    }

    private parseResponse(response: string): { heb: number[]; eng: number[] }[] {
        const match = response.match(/\[[\s\S]*\]/);
        if (!match) {
            throw new Error("No JSON array found in LLM response");
        }
        return JSON.parse(match[0]) as { heb: number[]; eng: number[] }[];
    }
}
