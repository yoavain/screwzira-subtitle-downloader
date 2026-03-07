export interface SubtitleEntry {
    index: number;
    start: number; // milliseconds
    end: number; // milliseconds
    text: string; // may be multi-line, joined with \n
}

export interface MatchEntry {
    hebrewIndices: number[]; // zero-based array indices into the hebrew entries array
    englishIndices: number[]; // zero-based array indices into the english entries array
    offset: number; // english_midpoint - hebrew_midpoint (ms)
}

export interface SceneChunk {
    hebrewStartIdx: number;
    hebrewEndIdx: number;
    medianOffset: number; // ms
}

export interface SyncConfig {
    syncEnabled: boolean;
    ollamaBaseUrl: string;
    ollamaModel: string;
    syncChunkThresholdSeconds: number;
    syncBatchSize: number;
}
