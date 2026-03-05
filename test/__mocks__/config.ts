import type { ConfigInterface } from "~src/config";

export class MockConfig implements ConfigInterface {
    replaceTitleIfNeeded = (): string => "";
    getLogLevel = (): string => "";
    getExtensions = (): string[] => [];
    getLanguageCode = (): string => "Hebrew";
    getSubtitlesSuffix = (): string => "Hebrew.srt";
    getSyncConfig = () => ({
        syncEnabled: false,
        ollamaBaseUrl: "",
        ollamaModel: "translategemma:12b",
        syncChunkThresholdSeconds: 0.3,
        syncBatchSize: 20
    });
}
