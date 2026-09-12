/**
 * Bytes <-> text for subtitle files.
 *
 * Many Hebrew subtitles are still Windows-1255, not UTF-8. Reading one as UTF-8 does not
 * throw: Node replaces every Hebrew byte with U+FFFD, and the writer then saves that loss
 * over the user's file. So a file is decoded as UTF-8 only when it really is UTF-8.
 *
 * Output is always UTF-8 with a BOM. Node cannot encode Windows-1255, and the BOM stops
 * players from guessing a legacy codepage for the file.
 */

const UTF8_BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

/** Language-specific fallback for bytes that are not valid UTF-8. */
const LEGACY_ENCODING = "windows-1255";

export function decodeSubtitle(bytes: Buffer): string {
    // TextDecoder consumes a leading BOM, which parseSrt would otherwise read as part of
    // the first index and drop that entry.
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        return new TextDecoder(LEGACY_ENCODING).decode(bytes);
    }
}

export function encodeSubtitle(text: string): Buffer {
    return Buffer.concat([UTF8_BOM, Buffer.from(text, "utf-8")]);
}
