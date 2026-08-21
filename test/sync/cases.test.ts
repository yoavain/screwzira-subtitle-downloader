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

        it("resolves to a single segment at scale 1", () => {
            const warp = timeWarp(testCase.target, testCase.reference);

            expect(warp.segments).toHaveLength(1);
            expect(warp.segments[0].scale).toBe(1);
            expect(warp.segments[0].startIdx).toBe(0);
            expect(warp.segments[0].endIdx).toBe(testCase.target.length - 1);
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
            ["constant -8500ms", { type: "constant", ms: -8500 } as const],
            ["framerate 23.976->25", { type: "scale", factor: 25 / 23.976 } as const]
        ])("recovers the baseline result after being de-synced: %s", (_label, transform) => {
            // Syncing the pristine target gives the baseline. De-syncing and re-syncing must
            // land in the same place, whatever the fixture's own residual offset happens to be.
            const baseline = retime(testCase.target, timeWarp(testCase.target, testCase.reference));
            const desynced = applyDesync(testCase.target, transform);
            const recovered = retime(desynced, timeWarp(desynced, testCase.reference));

            const score = scoreSync(recovered, baseline);
            expect(score.medianAbsStartErrorMs).toBeLessThanOrEqual(150);
            expect(score.withinThresholdRatio).toBeGreaterThanOrEqual(0.9);
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
            find: jest.fn().mockResolvedValue({ srtPath: copy.referencePath, language: "en", origin: "sidecar" })
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
