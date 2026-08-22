/**
 * Reasons Flow B can stop before writing anything.
 *
 * The gates themselves live in `SubtitleSyncer.sync`, where the orchestration is: each one
 * needs the value the previous step produced, so extracting them into standalone predicates
 * bought indirection and nothing else. This module holds only the vocabulary they report.
 *
 * G1 from the original plan is gone — choosing "Sync subtitle" is both the request and the
 * consent, so it was true by construction.
 */

export enum GateFailure {
    TARGET_UNREADABLE = "TARGET_UNREADABLE",
    TARGET_EMPTY = "TARGET_EMPTY",
    NO_REFERENCE = "NO_REFERENCE",
    REFERENCE_EMPTY = "REFERENCE_EMPTY"
}
