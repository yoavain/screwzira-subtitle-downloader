import type { SyncConfig } from "~src/sync/types";
import type { OllamaClientInterface } from "~src/sync/ollamaClient";
import type { LoggerInterface } from "~src/logger";

export async function syncPreflightCheck(
    config: SyncConfig,
    ollamaClient: OllamaClientInterface,
    logger: LoggerInterface
): Promise<boolean> {
    if (!config.syncEnabled) {
        return false;
    }

    if (!config.ollamaBaseUrl) {
        logger.warn("Sync: 'ollamaBaseUrl' not configured. Add it to ktuvit-downloader-config.json. Skipping sync.");
        return false;
    }

    if (!await ollamaClient.isReachable()) {
        logger.warn(`Sync: Cannot reach Ollama at ${config.ollamaBaseUrl}. Check that Ollama is running. Skipping sync.`);
        return false;
    }

    if (!await ollamaClient.isModelAvailable(config.ollamaModel)) {
        logger.warn(`Sync: Model '${config.ollamaModel}' not found in Ollama. Run: ollama pull ${config.ollamaModel}. Skipping sync.`);
        return false;
    }

    return true;
}
