import { writeSrt, formatTimestamp } from "~src/sync/subtitleWriter";
import type { SubtitleEntry } from "~src/sync/types";

describe("formatTimestamp", () => {
    it("formats zero correctly", () => {
        expect(formatTimestamp(0)).toBe("00:00:00,000");
    });

    it("formats milliseconds correctly", () => {
        expect(formatTimestamp(1500)).toBe("00:00:01,500");
    });

    it("formats full timestamp correctly", () => {
        const ms = (1 * 3600 + 23 * 60 + 45) * 1000 + 678;
        expect(formatTimestamp(ms)).toBe("01:23:45,678");
    });

    it("pads single-digit values", () => {
        expect(formatTimestamp(1000)).toBe("00:00:01,000");
    });
});

describe("writeSrt", () => {
    const entries: SubtitleEntry[] = [
        { index: 1, start: 1000, end: 4000, text: "Hello world" },
        { index: 2, start: 5000, end: 8500, text: "Multi\nline text" }
    ];

    it("produces correct SRT format", () => {
        const output = writeSrt(entries);
        expect(output).toContain("1\n00:00:01,000 --> 00:00:04,000\nHello world");
        expect(output).toContain("2\n00:00:05,000 --> 00:00:08,500\nMulti\nline text");
    });

    it("re-numbers entries from 1", () => {
        const reIndexed: SubtitleEntry[] = [
            { index: 99, start: 1000, end: 2000, text: "A" },
            { index: 200, start: 3000, end: 4000, text: "B" }
        ];
        const output = writeSrt(reIndexed);
        expect(output).toContain("1\n");
        expect(output).toContain("2\n");
        expect(output).not.toContain("99\n");
    });

    it("separates entries with double newline", () => {
        const output = writeSrt(entries);
        expect(output).toContain("\n\n");
    });

    it("returns empty string for empty array", () => {
        expect(writeSrt([])).toBe("\n");
    });
});
