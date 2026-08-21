import type { ConfigInterface, SyncConfig } from "~src/config";

export class MockConfig implements ConfigInterface {
    replaceTitleIfNeeded = (): string => "";
    getLogLevel = (): string => "";
    getExtensions = (): string[] => [];
    getLanguageCode = (): string => "Hebrew";
    getSyncConfig = (): SyncConfig => ({
        referenceLanguages: ["fr", "en"],
        splitPenaltyMs: 7000,
        maxOffsetMs: 180_000,
        minSegmentEntries: 3,
        minConfidence: 0.25
    });
    getCheckEmbeddedSubtitles = (): boolean => false;
}
