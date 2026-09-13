/**
 * Encode Hebrew text as Windows-1255 for tests. Node can only encode UTF-8, and many
 * Hebrew subtitles in the wild are still Windows-1255, so tests build those bytes here.
 * Covers ASCII and the 27 Hebrew letters, which is all the tests need.
 */
export function toWindows1255(text: string): Buffer {
    return Buffer.from([...text].map((char) => {
        const code = char.codePointAt(0);
        if (code < 0x80) {
            return code;
        }
        if (code >= 0x05D0 && code <= 0x05EA) {
            return code - 0x05D0 + 0xE0;
        }
        throw new Error(`toWindows1255: no mapping for U+${code.toString(16)}`);
    }));
}
