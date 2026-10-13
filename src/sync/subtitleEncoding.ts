/**
 * Bytes <-> text for subtitle files.
 *
 * Many Hebrew subtitles are still Windows-1255, not UTF-8. Reading one as UTF-8 does not
 * throw: Node replaces every Hebrew byte with U+FFFD, and the writer then saves that loss
 * over the user's file. So a file is decoded as UTF-8 only when it really is UTF-8.
 * The download flow has the mirror problem: saved as served, a Windows-1255 subtitle
 * shows as garbage in players that assume UTF-8, so it is converted before it is saved.
 *
 * Output is always UTF-8 with a BOM. Node cannot encode Windows-1255, and the BOM stops
 * players from guessing a legacy codepage for the file.
 */

const UTF8_BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

/** Language-specific fallback for bytes that are not valid UTF-8. */
const LEGACY_ENCODING = "windows-1255";

const HEBREW_LETTER = /[א-ת]/g;

export function decodeSubtitle(bytes: Buffer): string {
    // A UTF-16 BOM is never valid UTF-8, and the Hebrew-letter count below would pick
    // Windows-1255 for it: half the bytes of UTF-16 Hebrew land in its letter range.
    const utf16 = utf16EncodingOf(bytes);
    if (utf16) {
        return new TextDecoder(utf16).decode(bytes);
    }

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

function utf16EncodingOf(bytes: Buffer): "utf-16le" | "utf-16be" | undefined {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
        return "utf-16le";
    }
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
        return "utf-16be";
    }
    return undefined;
}

function countHebrewLetters(text: string): number {
    return text.split(HEBREW_LETTER).length - 1;
}

export function encodeSubtitle(text: string): Buffer {
    return Buffer.concat([UTF8_BOM, Buffer.from(text, "utf-8")]);
}
