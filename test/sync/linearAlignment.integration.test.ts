/**
 * Integration test for the sync algorithm using real subtitle files.
 *
 * Test data: The Office S01E01
 *   - Hebrew SRT: 375 entries, timestamps are ~2000 ms later than English
 *   - English SRT: 374 entries
 *
 * The Hebrew translator inserted a few extra lines that have no English
 * counterpart, so a fixed heb[i] → eng[i-1] mapping is wrong.
 * Ground-truth matches are built by timestamp proximity instead:
 * for each Hebrew entry, we look for an English entry whose start time
 * is within TOLERANCE_MS of (hebStart − EXPECTED_SHIFT_MS).
 *
 * The LLM step is bypassed entirely — the test exercises
 * parseSrt → detectChunks → applyTimingCorrections with real data.
 */

import * as fs from "fs";
import * as path from "path";
import { parseSrt } from "~src/sync/subtitleParser";
import { detectChunks } from "~src/sync/sceneDetector";
import { applyTimingCorrections } from "~src/sync/timingCorrector";
import type { MatchEntry, SubtitleEntry } from "~src/sync/types";
import { MockLogger } from "~test/__mocks__";

const LINEAR_DIR = path.resolve(__dirname, "../resources/sync/linear");
const HEB_PATH = path.join(LINEAR_DIR, "The.Office.S01E01.Pilot.720p.h264-CtrlHD.heb.srt");
const ENG_PATH = path.join(LINEAR_DIR, "The.Office.S01E01.Pilot.720p.h264-CtrlHD.en.srt");

const EXPECTED_HEB_COUNT = 375;
const EXPECTED_ENG_COUNT = 374;
const EXPECTED_SHIFT_MS = 2000;    // Hebrew start timestamps are ~2000 ms later than English
const MATCH_TOLERANCE_MS = 50;     // timestamp must be within 50 ms of expected position
const CHUNK_THRESHOLD_MS = 300;
const MAX_EXPECTED_CHUNKS = 5;     // a uniform-offset file should produce very few chunks
// Midpoint-based offsets deviate from EXPECTED_SHIFT_MS when Hebrew and English entry
// durations differ. ±500 ms covers realistic duration variation in a human translation.
const OFFSET_TOLERANCE_MS = 500;

/**
 * Build ground-truth matches by timestamp proximity.
 * For each Hebrew entry (skipping the translator credits at 0 and end),
 * we search forward in the English entries for one whose start time is
 * within MATCH_TOLERANCE_MS of (hebStart − EXPECTED_SHIFT_MS).
 * Hebrew entries with no close English counterpart are left unmatched.
 */
function buildGroundTruthMatches(
    hebEntries: SubtitleEntry[],
    engEntries: SubtitleEntry[]
): MatchEntry[] {
    const matches: MatchEntry[] = [];
    let engIdx = 0;

    for (let hebIdx = 1; hebIdx < hebEntries.length - 1; hebIdx++) {
        const heb = hebEntries[hebIdx];
        const targetEngStart = heb.start - EXPECTED_SHIFT_MS;

        for (let j = engIdx; j < Math.min(engIdx + 5, engEntries.length); j++) {
            if (Math.abs(engEntries[j].start - targetEngStart) <= MATCH_TOLERANCE_MS) {
                const eng = engEntries[j];
                const hebMid = (heb.start + heb.end) / 2;
                const engMid = (eng.start + eng.end) / 2;
                matches.push({
                    hebrewIndices: [hebIdx],
                    englishIndices: [j],
                    offset: engMid - hebMid
                });
                engIdx = j + 1;
                break;
            }
        }
        // No close English entry found → Hebrew-only line (translator insertion)
    }

    return matches;
}

describe("Linear alignment integration test (The Office S01E01)", () => {
    const logger = new MockLogger();
    let hebEntries: SubtitleEntry[];
    let engEntries: SubtitleEntry[];
    let matches: MatchEntry[];

    beforeAll(() => {
        hebEntries = parseSrt(fs.readFileSync(HEB_PATH, "utf-8"));
        engEntries = parseSrt(fs.readFileSync(ENG_PATH, "utf-8"));
        matches = buildGroundTruthMatches(hebEntries, engEntries);
    });

    describe("parseSrt", () => {
        it("parses the Hebrew SRT into the expected number of entries", () => {
            expect(hebEntries).toHaveLength(EXPECTED_HEB_COUNT);
        });

        it("parses the English SRT into the expected number of entries", () => {
            expect(engEntries).toHaveLength(EXPECTED_ENG_COUNT);
        });

        it("first matched Hebrew entry is ~2000 ms later than its English counterpart", () => {
            // heb[1] and eng[0] are confirmed to be offset by exactly 2000 ms
            expect(hebEntries[1].start - engEntries[0].start).toBe(EXPECTED_SHIFT_MS);
            expect(hebEntries[1].end - engEntries[0].end).toBe(EXPECTED_SHIFT_MS);
        });
    });

    describe("buildGroundTruthMatches (proximity-based)", () => {
        it("produces at least 370 matches (≥ 99 % of the shorter file)", () => {
            // A few Hebrew lines are translator-only insertions with no English match
            expect(matches.length).toBeGreaterThanOrEqual(370);
        });

        it(`every match offset is within ${OFFSET_TOLERANCE_MS} ms of -${EXPECTED_SHIFT_MS} ms`, () => {
            // Offsets are midpoint-based (engMid − hebMid), so they deviate from the raw
            // start-time shift when entry durations differ between the two versions.
            for (const m of matches) {
                expect(m.offset).toBeGreaterThanOrEqual(-EXPECTED_SHIFT_MS - OFFSET_TOLERANCE_MS);
                expect(m.offset).toBeLessThanOrEqual(-EXPECTED_SHIFT_MS + OFFSET_TOLERANCE_MS);
            }
        });
    });

    describe("detectChunks", () => {
        it(`produces at most ${MAX_EXPECTED_CHUNKS} chunks for a near-uniform offset`, () => {
            const chunks = detectChunks(matches, CHUNK_THRESHOLD_MS);
            expect(chunks.length).toBeLessThanOrEqual(MAX_EXPECTED_CHUNKS);
        });

        it(`every chunk has a median offset within ${OFFSET_TOLERANCE_MS} ms of -${EXPECTED_SHIFT_MS} ms`, () => {
            const chunks = detectChunks(matches, CHUNK_THRESHOLD_MS);
            for (const chunk of chunks) {
                expect(chunk.medianOffset).toBeGreaterThanOrEqual(-EXPECTED_SHIFT_MS - OFFSET_TOLERANCE_MS);
                expect(chunk.medianOffset).toBeLessThanOrEqual(-EXPECTED_SHIFT_MS + OFFSET_TOLERANCE_MS);
            }
        });
    });

    describe("applyTimingCorrections", () => {
        let corrected: SubtitleEntry[];
        let matchedHebIndices: Set<number>;

        beforeAll(() => {
            const chunks = detectChunks(matches, CHUNK_THRESHOLD_MS);
            corrected = applyTimingCorrections(hebEntries, engEntries, matches, chunks, logger);
            matchedHebIndices = new Set(matches.flatMap((m) => m.hebrewIndices));
        });

        it("returns the same number of entries as the Hebrew input", () => {
            expect(corrected).toHaveLength(EXPECTED_HEB_COUNT);
        });

        it("corrected start times of matched entries are closer to English than original Hebrew", () => {
            // applyTimingCorrections applies a per-chunk median offset (not the exact per-entry
            // English timestamp), so corrected times won't be identical to English — but they
            // must be strictly closer than the original ~2000 ms shift.
            for (const m of matches) {
                const hebIdx = m.hebrewIndices[0];
                const engIdx = m.englishIndices[0];
                const originalError = Math.abs(hebEntries[hebIdx].start - engEntries[engIdx].start);
                const correctedError = Math.abs(corrected[hebIdx].start - engEntries[engIdx].start);
                expect(correctedError).toBeLessThan(originalError);
            }
        });

        it("corrected end times of matched entries are closer to English than original Hebrew", () => {
            for (const m of matches) {
                const hebIdx = m.hebrewIndices[0];
                const engIdx = m.englishIndices[0];
                const originalError = Math.abs(hebEntries[hebIdx].end - engEntries[engIdx].end);
                const correctedError = Math.abs(corrected[hebIdx].end - engEntries[engIdx].end);
                expect(correctedError).toBeLessThan(originalError);
            }
        });

        it("unmatched entries (translator-only credits and insertions) keep original timings", () => {
            for (let i = 0; i < corrected.length; i++) {
                if (!matchedHebIndices.has(i)) {
                    expect(corrected[i].start).toBe(hebEntries[i].start);
                    expect(corrected[i].end).toBe(hebEntries[i].end);
                }
            }
        });

        it("preserves all Hebrew text in the corrected output", () => {
            for (let i = 0; i < corrected.length; i++) {
                expect(corrected[i].text).toBe(hebEntries[i].text);
            }
        });
    });
});
