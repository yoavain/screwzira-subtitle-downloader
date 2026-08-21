# Testing the Sync Pipeline

How the fixture corpus works and how to add a case.

---

## The core idea: ground truth without hand labelling

A fixture is a pair of subtitles **already correctly timed for the same release**. The harness
de-syncs the target with a known transform, runs the pipeline, and compares the result against the
original timings.

That means no manual alignment labels are ever needed, and one fetched pair yields many scenarios.

```
original target ──apply known de-sync──▶ broken ──pipeline──▶ recovered
       └────────────────── compare ──────────────────────────────┘
```

## Layout

```
test/resources/sync/
  cases/
    <case-name>/
      <anything>.heb.srt      # target — the subtitle to fix
      <anything>.eng.srt      # reference — correctly timed
  linear/                     # The Office S01E01, used by timeWarp.test.ts
  mkvtoolnix/                 # mkvmerge -J sample output
```

`loadCase()` finds the two sides by suffix, so filenames only need the right ending:

| Side | Accepted suffixes |
|---|---|
| target | `.heb.srt`, `.he.srt`, `.hebrew.srt` |
| reference | `.fr.srt`, `.fra.srt`, `.fre.srt`, `.en.srt`, `.eng.srt` |

New case directories are picked up automatically — `listCaseNames()` scans the folder, and
`cases.test.ts` runs every generic assertion against each one. **No registration step.**

## Fixture files are read-only

This is the rule that matters most. The sync pipeline writes **in place** — it overwrites the target
and drops a `.bak` beside it — and the reference finder extracts embedded tracks next to the video.
A careless test would silently edit the corpus.

Three protections:

1. **By construction.** `test/sync/fixtures.ts` never hands out a fixture path for writing. You get
   parsed entries, or a temp copy via `copyCaseToTmp()`.
2. **By assertion.** Suites hash the tree in `beforeAll` and re-check in `afterAll` with
   `expectFixturesUnchanged()`, so a stray write fails loudly.
3. **By git.** `.gitattributes` marks `test/resources/sync/cases/** -text`, so `core.autocrlf`
   cannot rewrite line endings between a Windows and a Linux checkout.

Anything that runs `SubtitleSyncer` must use `copyCaseToTmp()`.

## Adding a case

1. Create `test/resources/sync/cases/<name>/`.
2. Drop in the target and reference `.srt`, correctly timed **for the same release**.
3. Run `npx jest test/sync/cases.test.ts`.

That is all — the generic assertions apply automatically:

* both sides parse
* segments are contiguous, cover every entry, and sit at scale 1
* confidence > 0.9
* overlap with the reference does not decrease
* output is well-formed (see below)
* a constant de-sync round-trips to the baseline within 150 ms
* a framerate de-sync round-trips within 300 ms median / 1000 ms p90
* injecting an ad-break cut produces a second segment

If a case has behaviour worth pinning beyond that — as `multi-segments` does — add a dedicated
`describe` block guarded by `caseNames.includes(...)` so the suite still passes for anyone without
that fixture.

### Naming the reference by what it exercises

The existing corpus is one Community episode shifted four ways:

| Case | What it tests |
|---|---|
| `match` | baseline — near-aligned |
| `ahead` | +1000 ms relative to `match` |
| `dealy` | −1500 ms relative to `match` |
| `multi-segments` | five segments stepping by −400/−1300/−400/−1500 ms |

Because they are the same episode, the *differences* between recovered offsets are exact properties
of the data. `cases.test.ts` asserts those directly, which is a stronger check than any absolute
threshold.

Note the corpus is deliberately adversarial: 475 target entries against 513 reference entries, so
index-aligned drift grows to 82.9 s across the episode. Anything assuming `target[i]` matches
`reference[i]` fails outright.

## De-sync transforms

`test/sync/desync.ts`:

| Transform | Models |
|---|---|
| `{ type: "constant", ms }` | the common real-world case |
| `{ type: "cuts", points: [{ atMs, deltaMs }] }` | ad break, director's cut |
| `{ type: "scale", factor }` | framerate mismatch — 23.976 vs 25 fps is `25 / 23.976` |
| `{ type: "drift", fromMs, toMs }` | error growing linearly across the file |

## Scoring

`test/sync/scoreSync.ts`:

```ts
scoreSync(corrected, groundTruth) -> {
    medianAbsStartErrorMs, p90AbsStartErrorMs, maxAbsStartErrorMs,
    withinThresholdRatio, entryCount
}
```

`withinThresholdRatio` — the fraction within 150 ms — is the number that tracks "feels in sync".

`assertWellFormed(corrected, original)` checks the invariants that must hold for **any** output, even
with no ground truth: text byte-identical, entry count unchanged, every entry positive-length,
monotonic starts, and no overlap that the original did not already have.

## Suites

| File | Covers | Needs |
|---|---|---|
| `timeWarp.test.ts` | Stage 1 on synthetic signals and The Office fixture | — |
| `segmentFitter.test.ts` | split-penalty DP, `mergeShortRuns` | — |
| `retimer.test.ts` | warp application and the repair pass | — |
| `referenceSourceFinder.test.ts` | stem derivation, language priority, embedded-vs-sidecar | mocked extractor |
| `subtitleSyncer.test.ts` | gate paths, backup, write | temp dirs |
| `cases.test.ts` | fixture corpus, end to end | temp copies |
| `ollamaClient.integration.test.ts` | real Ollama | `OLLAMA_INTEGRATION=true` |

## Gap worth closing

`referenceSourceFinder` is tested against a **mocked** `MkvExtractor`. The real `mkvmerge -J` →
`mkvextract` path has never run end to end against an actual MKV carrying an embedded French or
English track. A small MKV fixture with one text subtitle track would close the last untested link;
`test/resources/sync/mkvtoolnix/sample.mkv` exists but is not currently wired into that suite.
