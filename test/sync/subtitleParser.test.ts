import { parseSrt } from "~src/sync/subtitleParser";
import type { SubtitleEntry } from "~src/sync/types";

const SIMPLE_SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,000 --> 00:00:08,500
This is a subtitle

3
00:01:00,000 --> 00:01:02,123
Multi
line text
`;

const CRLF_SRT = "1\r\n00:00:01,000 --> 00:00:04,000\r\nHello\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,000\r\nWorld\r\n";

describe("parseSrt", () => {
    it("parses simple SRT correctly", () => {
        const entries: SubtitleEntry[] = parseSrt(SIMPLE_SRT);
        expect(entries).toHaveLength(3);

        expect(entries[0]).toEqual({ index: 1, start: 1000, end: 4000, text: "Hello world" });
        expect(entries[1]).toEqual({ index: 2, start: 5000, end: 8500, text: "This is a subtitle" });
        expect(entries[2]).toEqual({ index: 3, start: 60000, end: 62123, text: "Multi\nline text" });
    });

    it("parses CRLF line endings", () => {
        const entries = parseSrt(CRLF_SRT);
        expect(entries).toHaveLength(2);
        expect(entries[0].text).toBe("Hello");
        expect(entries[1].text).toBe("World");
    });

    it("parses timestamp components correctly", () => {
        const srt = "1\n01:23:45,678 --> 02:34:56,789\nText\n";
        const [entry] = parseSrt(srt);
        expect(entry.start).toBe((1 * 3600 + 23 * 60 + 45) * 1000 + 678);
        expect(entry.end).toBe((2 * 3600 + 34 * 60 + 56) * 1000 + 789);
    });

    it("skips malformed blocks", () => {
        const srt = "not-a-number\n00:00:01,000 --> 00:00:02,000\nText\n\n1\n00:00:03,000 --> 00:00:04,000\nOK\n";
        const entries = parseSrt(srt);
        expect(entries).toHaveLength(1);
        expect(entries[0].text).toBe("OK");
    });

    it("returns empty array for empty input", () => {
        expect(parseSrt("")).toHaveLength(0);
    });

    it("skips blocks where time line has no ' --> ' arrow", () => {
        const srt = "1\nno arrow here\nText\n\n2\n00:00:01,000 --> 00:00:02,000\nOK\n";
        const entries = parseSrt(srt);
        expect(entries).toHaveLength(1);
        expect(entries[0].text).toBe("OK");
    });
});


describe("parseSrt - malformed timestamps are rejected, not turned into NaN", () => {
    it("rejects a WebVTT-style dot separator", () => {
        // A .vtt saved as .srt used to parse to NaN, and the writer put "NaN:NaN:NaN,NaN"
        // over the user's file.
        expect(parseSrt("1\n00:00:01.000 --> 00:00:02.000\nhello\n")).toHaveLength(0);
    });

    it.each([
        ["missing milliseconds", "1\n00:00:01 --> 00:00:02\nx\n"],
        ["single-digit minutes", "1\n00:1:02,000 --> 00:1:03,000\nx\n"],
        ["letters", "1\naa:bb:cc,ddd --> ee:ff:gg,hhh\nx\n"],
        ["empty timestamp", "1\n --> \nx\n"]
    ])("rejects %s", (_label, srt) => {
        expect(parseSrt(srt)).toHaveLength(0);
    });

    it("keeps the valid blocks and drops only the malformed one", () => {
        const mixed = "1\n00:00:01,000 --> 00:00:02,000\nok\n\n2\n00:00:03.000 --> 00:00:04.000\nbad\n\n3\n00:00:05,000 --> 00:00:06,000\nalso ok\n";
        const entries = parseSrt(mixed);

        expect(entries).toHaveLength(2);
        expect(entries.map((e) => e.text)).toEqual(["ok", "also ok"]);
    });

    it("accepts more than two digits of hours", () => {
        expect(parseSrt("1\n100:00:01,000 --> 100:00:02,000\nx\n")[0].start).toBe(360_001_000);
    });

    it("never produces a non-finite time", () => {
        for (const entry of parseSrt("1\n00:00:01,000 --> 00:00:02,000\nx\n")) {
            expect(Number.isFinite(entry.start)).toBe(true);
            expect(Number.isFinite(entry.end)).toBe(true);
        }
    });
});
