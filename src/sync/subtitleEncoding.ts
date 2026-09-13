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

const HEBREW_LETTER = /[א-ת]/g;

export function decodeSubtitle(bytes: Buffer): string {
    // TextDecoder consumes a leading BOM, which parseSrt would otherwise read as part of
    // the first index and drop that entry.
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    }
    catch {
        // Not strictly UTF-8. It may still be a UTF-8 file with one stray legacy byte, and
        // decoding that as Windows-1255 garbles every Hebrew line to save one byte. The
        // target is always Hebrew, so the decoding that yields more Hebrew letters is the
        // right one. Counting U+FFFD cannot tell them apart: Windows-1255 maps nearly every
        // byte to some character, so it produces none either way.
        const utf8 = new TextDecoder("utf-8").decode(bytes);
        const legacy = new TextDecoder(LEGACY_ENCODING).decode(bytes);
        return countHebrewLetters(legacy) > countHebrewLetters(utf8) ? legacy : utf8;
    }
}

function countHebrewLetters(text: string): number {
    return text.split(HEBREW_LETTER).length - 1;
}

export function encodeSubtitle(text: string): Buffer {
    return Buffer.concat([UTF8_BOM, Buffer.from(text, "utf-8")]);
}
