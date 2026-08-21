/**
 * One table for every way a language gets spelled.
 *
 * MKV tracks are tagged ISO 639-2/B (`fre`, `ger`), ISO 639-2/T (`fra`, `deu`) or BCP 47
 * (`fr`, `de`); sidecar files use any of those plus the English name (`Movie.french.srt`).
 * These used to live as separate tables in mkvExtractor, referenceSourceFinder, index.ts
 * and the scan script, which had already drifted apart — the script's list was missing
 * `fre` and `french`, and only two languages worked at all despite `referenceLanguages`
 * being a user-facing config key.
 */

/** Every accepted spelling per language, keyed by every accepted spelling. */
const ALIAS_GROUPS: string[][] = [
    ["he", "heb", "iw", "hebrew"],
    ["en", "eng", "english"],
    ["fr", "fra", "fre", "french"],
    ["es", "spa", "esp", "spanish"],
    ["de", "deu", "ger", "german"],
    ["it", "ita", "italian"],
    ["pt", "por", "portuguese"],
    ["nl", "dut", "nld", "dutch"],
    ["ru", "rus", "russian"],
    ["ar", "ara", "arabic"],
    ["pl", "pol", "polish"],
    ["tr", "tur", "turkish"],
    ["sv", "swe", "swedish"],
    ["da", "dan", "danish"],
    ["no", "nor", "norwegian"],
    ["fi", "fin", "finnish"],
    ["cs", "ces", "cze", "czech"],
    ["el", "ell", "gre", "greek"],
    ["ja", "jpn", "japanese"],
    ["ko", "kor", "korean"],
    ["zh", "zho", "chi", "chinese"]
];

const BY_ALIAS = new Map<string, string[]>();
for (const group of ALIAS_GROUPS) {
    for (const alias of group) {
        BY_ALIAS.set(alias, group);
    }
}

/**
 * Subtitle variant flags. Not languages — they mark a kind of subtitle — but they appear in
 * the same dot-separated position in a filename, so stem derivation has to strip them too.
 */
export const VARIANT_TAGS = ["forced", "sdh", "hi", "cc"];

/**
 * Every spelling of `code`, or just `code` itself when it is not a language we know.
 * Case-insensitive; the returned aliases are always lower case.
 */
export function aliasesFor(code: string): string[] {
    const normalized = code.trim().toLowerCase();
    return BY_ALIAS.get(normalized) ?? [normalized];
}

/** True when `candidate` is any spelling of `code`. Both sides are case-insensitive. */
export function isLanguage(candidate: string | undefined, code: string): boolean {
    if (!candidate) {
        return false;
    }
    return aliasesFor(code).includes(candidate.trim().toLowerCase());
}

/** Tags that may be stripped from the end of a subtitle filename stem. */
export function strippableTags(targetLanguage: string): string[] {
    return [...aliasesFor(targetLanguage), ...VARIANT_TAGS];
}
