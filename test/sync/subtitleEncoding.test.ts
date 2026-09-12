import { decodeSubtitle, encodeSubtitle } from "~src/sync/subtitleEncoding";
import { toWindows1255 } from "~test/sync/windows1255";

const HEBREW = "1\r\n00:00:40,541 --> 00:00:44,503\r\nג'ודי דייויס\r\n";

describe("decodeSubtitle", () => {
    it("decodes a Windows-1255 file as Hebrew", () => {
        expect(decodeSubtitle(toWindows1255(HEBREW))).toBe(HEBREW);
    });

    it("decodes a UTF-8 file without a BOM", () => {
        expect(decodeSubtitle(Buffer.from(HEBREW, "utf-8"))).toBe(HEBREW);
    });

    it("keeps a UTF-8 file as UTF-8 when one stray legacy byte breaks strict decoding", () => {
        // Decoding the whole file as Windows-1255 would garble every Hebrew line to lose one byte.
        const bytes = Buffer.concat([Buffer.from(HEBREW, "utf-8"), Buffer.from([0xE9, 0x0D, 0x0A])]);
        expect(decodeSubtitle(bytes)).toBe(`${HEBREW}�\r\n`);
    });

    it("strips a UTF-8 BOM, which parseSrt would read as part of the first index", () => {
        const bytes = Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(HEBREW, "utf-8")]);
        expect(decodeSubtitle(bytes)).toBe(HEBREW);
    });
});

describe("encodeSubtitle", () => {
    it("writes UTF-8 with a BOM, so players do not guess a legacy codepage", () => {
        const bytes = encodeSubtitle(HEBREW);
        expect([...bytes.subarray(0, 3)]).toEqual([0xEF, 0xBB, 0xBF]);
        expect(bytes.subarray(3).toString("utf-8")).toBe(HEBREW);
    });

    it("round-trips through decodeSubtitle", () => {
        expect(decodeSubtitle(encodeSubtitle(HEBREW))).toBe(HEBREW);
    });
});
