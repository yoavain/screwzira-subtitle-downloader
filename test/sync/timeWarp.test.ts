import * as fs from "node:fs";
import * as path from "node:path";
import { parseSrt } from "~src/sync/subtitleParser";
import { timeWarp, applyWarp, segmentFor } from "~src/sync/timeWarp";
import { retime } from "~src/sync/retimer";
import type { SubtitleEntry, TimeSpan } from "~src/sync/types";
import { applyDesync } from "~test/sync/desync";
import { scoreSync, assertWellFormed } from "~test/sync/scoreSync";

const FIXTURE_DIR = path.resolve(__dirname, "../resources/sync/linear");
const HEB_PATH = path.join(FIXTURE_DIR, "The.Office.S01E01.Pilot.720p.h264-CtrlHD.heb.srt");
const ENG_PATH = path.join(FIXTURE_DIR, "The.Office.S01E01.Pilot.720p.h264-CtrlHD.en.srt");

/** Synthetic dialogue: entries of varying length with varying gaps, like real speech. */
function makeSpans(count: number, seed = 1): TimeSpan[] {
    const spans: TimeSpan[] = [];
    let t = 1000;
    let rnd = seed;
    for (let i = 0; i < count; i++) {
        rnd = (rnd * 1103515245 + 12345) % 2147483648;
        const duration = 1200 + (rnd % 2400);
        rnd = (rnd * 1103515245 + 12345) % 2147483648;
        const gap = 200 + (rnd % 3000);
        spans.push({ start: t, end: t + duration });
        t += duration + gap;
    }
    return spans;
}

function shiftSpans(spans: TimeSpan[], ms: number): TimeSpan[] {
    return spans.map((s) => ({ start: s.start + ms, end: s.end + ms }));
}

describe("timeWarp — synthetic", () => {
    it("recovers a constant offset", () => {
        const reference = makeSpans(120);
        const target = shiftSpans(reference, 2000);

        const warp = timeWarp(target, reference);

        expect(warp.segments).toHaveLength(1);
        expect(warp.segments[0].offset).toBeCloseTo(-2000, -1);
        expect(warp.confidence).toBeGreaterThan(0.9);
    });

    it("recovers a negative offset", () => {
        const reference = makeSpans(120, 7);
        const target = shiftSpans(reference, -3500);

        const warp = timeWarp(target, reference);

        expect(warp.segments).toHaveLength(1);
        expect(warp.segments[0].offset).toBeCloseTo(3500, -1);
    });

    it("finds two segments across an ad break", () => {
        const reference = makeSpans(160, 3);
        const cutAt = reference[80].start;
        const target = reference.map((s) => {
            const delta = s.start >= cutAt ? 45_000 : 2000;
            return { start: s.start + delta, end: s.end + delta };
        });

        const warp = timeWarp(target, reference);

        expect(warp.segments).toHaveLength(2);
        expect(warp.segments[0].offset).toBeCloseTo(-2000, -1);
        expect(warp.segments[1].offset).toBeCloseTo(-45_000, -1);
        expect(warp.segments[0].endIdx).toBe(79);
        expect(warp.segments[1].startIdx).toBe(80);
    });

    it("does not split when a single offset explains the data", () => {
        const reference = makeSpans(200, 11);
        const target = shiftSpans(reference, 1500);

        const warp = timeWarp(target, reference);

        expect(warp.segments).toHaveLength(1);
    });

    it("recovers a framerate mismatch as a scale, not as many segments", () => {
        const reference = makeSpans(200, 5);
        const factor = 25 / 23.976;
        const target = reference.map((s) => ({ start: s.start * factor, end: s.end * factor }));

        const warp = timeWarp(target, reference);

        expect(warp.segments.length).toBeLessThanOrEqual(2);
        expect(warp.segments[0].scale).toBeCloseTo(1 / factor, 3);
        expect(warp.confidence).toBeGreaterThan(0.8);
    });

    it("reports low confidence for unrelated inputs", () => {
        const reference = makeSpans(120, 2);
        const target = makeSpans(120, 999).map((s) => ({ start: s.start + 5_000_000, end: s.end + 5_000_000 }));

        const warp = timeWarp(target, reference, { maxOffsetMs: 1000 });

        expect(warp.confidence).toBeLessThan(0.3);
    });

    it("survives empty input", () => {
        expect(timeWarp([], makeSpans(10)).confidence).toBe(0);
        expect(timeWarp(makeSpans(10), []).confidence).toBe(0);
    });
});

describe("timeWarp — The Office S01E01 (real fixture)", () => {
    let heb: SubtitleEntry[];
    let eng: SubtitleEntry[];

    beforeAll(() => {
        heb = parseSrt(fs.readFileSync(HEB_PATH, "utf-8"));
        eng = parseSrt(fs.readFileSync(ENG_PATH, "utf-8"));
    });

    it("parses both fixtures", () => {
        expect(heb).toHaveLength(375);
        expect(eng).toHaveLength(374);
    });

    it("finds the known ~2000 ms shift as a single segment", () => {
        const warp = timeWarp(heb, eng);

        expect(warp.segments).toHaveLength(1);
        expect(warp.segments[0].offset).toBeGreaterThan(-2200);
        expect(warp.segments[0].offset).toBeLessThan(-1800);
        expect(warp.confidence).toBeGreaterThan(0.6);
    });

    it("brings corrected Hebrew timings onto the English timeline", () => {
        const warp = timeWarp(heb, eng);
        const corrected = applyWarp(heb, warp);

        // heb[1] and eng[0] are confirmed to be offset by exactly 2000 ms.
        expect(Math.abs(corrected[1].start - eng[0].start)).toBeLessThan(150);
    });

    describe.each([
        ["constant +2000ms", { type: "constant", ms: 2000 } as const, 1],
        ["constant -8500ms", { type: "constant", ms: -8500 } as const, 1],
        ["ad break at 10min", { type: "cuts", points: [{ atMs: 600_000, deltaMs: -45_000 }] } as const, 2],
        ["framerate 23.976->25", { type: "scale", factor: 25 / 23.976 } as const, 1]
    ])("de-synced against its own ground truth: %s", (_name, transform, expectedSegments) => {
        // The Hebrew file is already correctly timed for this release, so it is its own
        // ground truth. De-sync it, then check the pipeline puts it back.
        let desynced: SubtitleEntry[];
        let corrected: SubtitleEntry[];

        beforeAll(() => {
            desynced = applyDesync(heb, transform);
            corrected = retime(desynced, timeWarp(desynced, heb));
        });

        it(`recovers ${expectedSegments} segment(s)`, () => {
            expect(timeWarp(desynced, heb).segments).toHaveLength(expectedSegments);
        });

        it("puts the median entry back within 150 ms", () => {
            const score = scoreSync(corrected, heb);
            expect(score.medianAbsStartErrorMs).toBeLessThanOrEqual(150);
        });

        it("puts at least 90 % of entries within 150 ms", () => {
            expect(scoreSync(corrected, heb).withinThresholdRatio).toBeGreaterThanOrEqual(0.9);
        });

        it("emits a well-formed subtitle list", () => {
            assertWellFormed(corrected, desynced);
        });
    });
});

describe("segmentFor", () => {
    const segments = [
        { startIdx: 0, endIdx: 9, scale: 1, offset: 100 },
        { startIdx: 10, endIdx: 19, scale: 1, offset: 200 }
    ];

    it("finds the containing segment", () => {
        expect(segmentFor(5, segments).offset).toBe(100);
        expect(segmentFor(15, segments).offset).toBe(200);
    });

    it("extrapolates below the first and above the last", () => {
        expect(segmentFor(-1, segments).offset).toBe(100);
        expect(segmentFor(999, segments).offset).toBe(200);
    });

    it("falls back to identity with no segments", () => {
        expect(segmentFor(0, []).offset).toBe(0);
        expect(segmentFor(0, []).scale).toBe(1);
    });
});
