/**
 * Gates for Flow B, evaluated in order.
 *
 * G1 from the v1 plan is gone: right-clicking "Sync subtitle" is both the request and the
 * consent, so it was true by construction.
 *
 * G2 and G3 are hard and local — evaluate them before touching the network, because there
 * is no point asking Ollama anything when there is nothing to sync. They notify rather
 * than only logging: sync is the whole point of this invocation, so a silent skip would
 * look like the tool did nothing.
 *
 * G4 and G5 are soft. Missing Ollama downgrades the bead scorer (Phase 3); it never stops
 * the sync, because Stage 1 is language-agnostic and needs no AI at all.
 */

import type { LoggerInterface } from "~src/logger";

export enum GateFailure {
    TARGET_UNREADABLE = "TARGET_UNREADABLE",
    TARGET_EMPTY = "TARGET_EMPTY",
    NO_REFERENCE = "NO_REFERENCE",
    REFERENCE_EMPTY = "REFERENCE_EMPTY"
}

export interface GateResult {
    ok: boolean;
    failure?: GateFailure;
    message?: string;
}

export const GATE_OK: GateResult = { ok: true };

export function gateFailed(failure: GateFailure, message: string): GateResult {
    return { ok: false, failure, message };
}

export interface OllamaGateInput {
    baseUrl: string;
    model: string;
    isReachable: () => Promise<boolean>;
    isModelAvailable: (model: string) => Promise<boolean>;
}

/**
 * Soft gates. Returns whether an embedding-backed scorer may be used. A false result is a
 * quality downgrade, never a failure.
 */
export async function canUseEmbeddings(input: OllamaGateInput, logger: LoggerInterface): Promise<boolean> {
    if (!input.baseUrl) {
        logger.warn("Sync: 'ollamaBaseUrl' not configured — using timing-only alignment.");
        return false;
    }
    if (!await input.isReachable()) {
        logger.warn(`Sync: Cannot reach Ollama at ${input.baseUrl} — using timing-only alignment.`);
        return false;
    }
    if (!await input.isModelAvailable(input.model)) {
        logger.warn(`Sync: Model '${input.model}' not found in Ollama. Run: ollama pull ${input.model} — using timing-only alignment.`);
        return false;
    }
    return true;
}
