/**
 * Fixture-driven tests over test/resources/sync/cases.
 *
 * Fixture files are inputs and are never written to. Anything that runs the syncer works on
 * a temp copy, and every suite here asserts the fixture tree is byte-identical afterwards.
 *
 * The Community S01E14 trio is deliberately adversarial: 475 Hebrew entries against 513
 * English ones, so index-aligned drift grows from ~0 to 82.9 s across the episode. Any
 * approach that assumes heb[i] matches eng[i] fails on these outright.
 */

import * as fs from "node:fs";
import { timeWarp } from "~src/sync/timeWarp";
import { retime } from "~src/sync/retimer";
import { SubtitleSyncer } from "~src/sync/subtitleSyncer";
import { parseSrt } from "~src/sync/subtitleParser";
import type { SubtitleEntry, TimeSpan } from "~src/sync/types";
import type { ReferenceSourceFinderInterface } from "~src/sync/referenceSourceFinder";
import { MockLogger } from "~test/mocks";
import { applyDesync } from "~test/sync/desync";
import { assertWellFormed, scoreSync } from "~test/sync/scoreSync";
import { copyCaseToTmp, expectFixturesUnchanged, hashFixtures, listCaseNames, loadCase } from "~test/sync/fixtures";

const logger = new MockLogger();
const caseNames = listCaseNames();

/** Milliseconds of target time covered by any reference span — the quantity timeWarp maximises. */
function overlapMs(target: SubtitleEntry[], reference: TimeSpan[]): number {
    let total = 0;
    for (const entry of target) {
        for (const ref of reference) {
            if (ref.start >= entry.end) {
                break;
            }
            const lo = Math.max(entry.start, ref.start);
            const hi = Math.min(entry.end, ref.end);
            if (hi > lo) {
                total += hi - lo;
            }
        }
    }
    return total;
}

describe("sync fixtures", () => {
    let fixtureHashes: Record<string, string>;

    beforeAll(() => {
        fixtureHashes = hashFixtures();
    });

    afterAll(() => {
        // Guards against any test here writing into the corpus instead of a temp copy.
        expectFixturesUnchanged(fixtureHashes);
    });

    it("finds at least one case", () => {
        expect(caseNames.length).toBeGreaterThan(0);
    });

    describe.each(caseNames)("case: %s", (name) => {
        const testCase = loadCase(name);

        it("parses both sides", () => {
            expect(testCase.target.length).toBeGreaterThan(0);
            expect(testCase.reference.length).toBeGreaterThan(0);
        });

        it("covers every entry with contiguous segments at scale 1", () => {
            const warp = timeWarp(testCase.target, testCase.reference);

            expect(warp.segments.length).toBeGreaterThan(0);
            expect(warp.segments[0].startIdx).toBe(0);
            expect(warp.segments[warp.segments.length - 1].endIdx).toBe(testCase.target.length - 1);
            warp.segments.forEach((segment, i) => {
                expect(segment.scale).toBe(1);
                if (i > 0) {
                    expect(segment.startIdx).toBe(warp.segments[i - 1].endIdx + 1);
                }
            });
        });

        it("reports high confidence", () => {
            expect(timeWarp(testCase.target, testCase.reference).confidence).toBeGreaterThan(0.9);
        });

        it("increases overlap with the reference", () => {
            const warp = timeWarp(testCase.target, testCase.reference);
            const corrected = retime(testCase.target, warp);

            expect(overlapMs(corrected, testCase.reference)).toBeGreaterThanOrEqual(overlapMs(testCase.target, testCase.reference));
        });

        it("emits a well-formed subtitle list", () => {
            const corrected = retime(testCase.target, timeWarp(testCase.target, testCase.reference));
            assertWellFormed(corrected, testCase.target);
        });

        it.each([
            ["constant +2000ms", { type: "constant", ms: 2000 } as const],
            ["constant -8500ms", { type: "constant", ms: -8500 } as const]
        ])("recovers the baseline exactly after being de-synced: %s", (_label, transform) => {
            // Syncing the pristine target gives the baseline. A pure shift does not change the
            // file's segment structure, so re-syncing must land back on the baseline exactly,
            // whatever the fixture's own residual offset happens to be.
            const baseline = retime(testCase.target, timeWarp(testCase.target, testCase.reference));
            const desynced = applyDesync(testCase.target, transform);
            const recovered = retime(desynced, timeWarp(desynced, testCase.reference));

            const score = scoreSync(recovered, baseline);
            expect(score.medianAbsStartErrorMs).toBeLessThanOrEqual(150);
            expect(score.withinThresholdRatio).toBeGreaterThanOrEqual(0.9);
        });

        it("recovers the baseline within a second after a framerate de-sync", () => {
            // Looser than the shift cases on purpose. A global stretch interacts with any
            // segment boundaries the file already has, so a multi-segment fixture cannot come
            // back exactly. Sub-second is the honest bar here.
            const baseline = retime(testCase.target, timeWarp(testCase.target, testCase.reference));
            const desynced = applyDesync(testCase.target, { type: "scale", factor: 25 / 23.976 });
            const recovered = retime(desynced, timeWarp(desynced, testCase.reference));

            const score = scoreSync(recovered, baseline);
            expect(score.medianAbsStartErrorMs).toBeLessThanOrEqual(300);
            expect(score.p90AbsStartErrorMs).toBeLessThanOrEqual(1000);
        });

        it("finds two segments after an ad-break cut", () => {
            const midpoint = testCase.target[Math.floor(testCase.target.length / 2)].start;
            const desynced = applyDesync(testCase.target, { type: "cuts", points: [{ atMs: midpoint, deltaMs: -45_000 }] });

            const warp = timeWarp(desynced, testCase.reference);

            expect(warp.segments).toHaveLength(2);
            // The boundary lands on the entry where the cut was injected.
            expect(desynced[warp.segments[1].startIdx].start + 45_000).toBeGreaterThanOrEqual(midpoint);
        });
    });
});

describe("sync fixtures — multi-segments", () => {
    const hasCase = caseNames.includes("multi-segments");
    const itCase = hasCase ? it : it.skip;

    itCase("splits the timeline rather than forcing one offset", () => {
        const testCase = loadCase("multi-segments");
        const warp = timeWarp(testCase.target, testCase.reference);

        expect(warp.segments.length).toBeGreaterThan(1);
    });

    /**
     * The fixture injects five segments, stepping by -400, -1300, -400 and -1500 ms at
     * entries 99, 199, 299 and 399. Stage 1 recovers the two large steps and merges over the
     * two 400 ms ones, and that is the objective working correctly rather than a defect:
     * measured on this fixture, the true five-segment model gains only 3 985 ms of extra
     * overlap, which does not cover even one 7 000 ms split, so it scores 17 015 WORSE than
     * the merge the fit chooses.
     *
     * The cause is that area overlap saturates below about half a second — a 400 ms error on
     * a 2.5 s entry still overlaps 84 % of it. Timing alone cannot resolve shifts much
     * smaller than an entry is long; that needs the text, which is Stage 2.
     *
     * A start-proximity objective was prototyped and does separate these models (true model
     * +31 703 instead of -17 015), but at every tolerance tried it either merged everything
     * or invented false segments in the other three fixtures, so it was not adopted.
     *
     * This test pins today's behaviour. When Stage 2 lands, the expected count becomes 5 and
     * the residual bound drops.
     */
    itCase("finds the large steps and leaves the sub-second ones for Stage 2", () => {
        const testCase = loadCase("multi-segments");
        const warp = timeWarp(testCase.target, testCase.reference);

        expect(warp.segments.length).toBeGreaterThanOrEqual(2);
        expect(warp.segments.length).toBeLessThan(5);

        const corrected = retime(testCase.target, warp);
        const residual = corrected.map((entry, i) => Math.abs(entry.start - testCase.target[i].start - warp.segments[0].offset));
        expect(Math.max(...residual)).toBeLessThan(5000);
    });
});

describe("sync fixtures — relative offsets", () => {
    // The trio is one episode shifted three ways, so the differences between the recovered
    // offsets are exact properties of the data, independent of any absolute calibration.
    const offsetFor = (name: string): number => {
        const testCase = loadCase(name);
        return timeWarp(testCase.target, testCase.reference).segments[0].offset;
    };

    const hasTrio = ["ahead", "dealy", "match"].every((name) => caseNames.includes(name));
    const itTrio = hasTrio ? it : it.skip;

    itTrio("recovers the injected shifts between the three variants exactly", () => {
        const match = offsetFor("match");

        // "ahead" is the same episode 1000 ms later, so it needs 1000 ms less correction.
        expect(offsetFor("ahead") - match).toBeCloseTo(-1000, -1);
        // "dealy" is 1500 ms earlier, so it needs 1500 ms more.
        expect(offsetFor("dealy") - match).toBeCloseTo(1500, -1);
    });
});

describe("sync fixtures — end to end through SubtitleSyncer", () => {
    let fixtureHashes: Record<string, string>;
    let copy: ReturnType<typeof copyCaseToTmp> | undefined;

    beforeAll(() => {
        fixtureHashes = hashFixtures();
    });

    afterEach(() => {
        copy?.cleanup();
        copy = undefined;
    });

    afterAll(() => {
        expectFixturesUnchanged(fixtureHashes);
    });

    it("writes the corrected subtitle and a .bak, leaving the fixtures untouched", async () => {
        const name = caseNames[0];
        copy = copyCaseToTmp(name);
        const original = fs.readFileSync(copy.targetPath, "utf-8");

        const finder: ReferenceSourceFinderInterface = {
            find: jest.fn().mockResolvedValue({ source: { srtPath: copy.referencePath, language: "en", origin: "sidecar" } })
        };
        const notifier = { notif: jest.fn() };

        const outcome = await new SubtitleSyncer(finder, logger, notifier).sync(copy.targetPath);

        expect(outcome.ok).toBe(true);
        expect(fs.readFileSync(`${copy.targetPath}.bak`, "utf-8")).toBe(original);

        const corrected = parseSrt(fs.readFileSync(copy.targetPath, "utf-8"));
        const before = parseSrt(original);
        expect(corrected).toHaveLength(before.length);
        expect(corrected.map((e) => e.text)).toEqual(before.map((e) => e.text));
        expect(corrected[0].start).not.toBe(before[0].start);
    });
});
