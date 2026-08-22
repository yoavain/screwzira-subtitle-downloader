# Sync Algorithm

How Flow B re-times a subtitle, why it is built this way, and what it cannot do.

For the control flow see [`flow-charts.md`](flow-charts.md). This document is about the algorithm.

---

## The problem, stated

Let `H = (h_1..h_n)` be the target subtitle's time spans and `R = (r_1..r_m)` the reference's, both
sorted. Find a monotonic piecewise-linear map `f: time -> time`, made of `k` segments
`f_s(t) = a_s * t + b_s`, maximising

```
  sum_i overlap( f(h_i), R )   -   splitPenalty * (k - 1)
```

`a_s` captures a framerate mismatch, `b_s` an offset, and each extra segment models one cut — an ad
break, a different edit, a missing cold open.

This is pure interval arithmetic. No text, no language, no AI.

## Prior art

This is not a new problem and the implementation does not invent an algorithm.

| Problem | Canonical name | Reference implementations |
|---|---|---|
| Timing alignment with cuts | Dynamic Time Warping with a split (change-point) penalty | [`alass`](https://github.com/kaegi/alass); [`ffsubsync`](https://github.com/smacke/ffsubsync) handles offset only, no cuts |
| Matching lines across languages (Stage 2, not built) | Bitext sentence alignment — Gale–Church bead DP | [Vecalign](https://github.com/bitextor/vecalign), [Bertalign](https://github.com/bfsujason/bertalign) |

`alass-core` exposes exactly this: *takes two sequences of time spans and returns the offsets for the
best alignment*, with a split penalty defaulting to 7. Our Stage 1 follows that formulation.

We implemented it in TypeScript rather than bundling `alass.exe` because Stage 3 needs the same
segment fitter over bead anchors, and because it avoids adding a Rust toolchain or another binary.
`alass` remains the quality bar: if it beats us on the fixture corpus, calling it instead is a
legitimate outcome.

---

## The four stages

Only Stage 2 will ever involve AI. Stages 2 and 3 are not built yet.

| Stage | Module | Score / signal | AI |
|---|---|---|---|
| 1 `timeWarp` | `src/sync/timeWarp.ts` | interval overlap | no |
| 2 `textAlign` | *not built* | pluggable bead scorer | optional |
| 3 `refit` | *not built* | bead anchors | no |
| 4 `retime` | `src/sync/retimer.ts` | — | no |

### Stage 1 — `timeWarp`

Never reads the text. Both files subtitle the same dialogue, so both light up when someone speaks and
go dark during silence. That rhythm is a fingerprint — roughly 400 events per episode with varying
durations and gaps.

```
REF (correct)        ██▁▁███▁▁█▁▁▁█████▁▁▁██▁▁████
TARGET (2 s late)  ▁▁██▁▁███▁▁█▁▁▁█████▁▁▁██▁▁████
                   └┬┘  slide until overlap peaks
```

Steps:

1. **Candidate offsets.** An optimal offset makes at least one target boundary coincide with a
   reference boundary, so the candidate set is finite: the pairwise differences
   `r.start - h.start` within `maxOffsetMs`, bucketed to `offsetBinMs` and weighted by entry
   duration. Only the top `maxCandidateOffsets` survive.
2. **Fit**, per framerate ratio, via `segmentFitter.fitSegments` — a DP over (entry × candidate
   offset) charging `splitPenaltyMs` whenever consecutive entries disagree.
3. **`mergeShortRuns`** folds runs shorter than `minSegmentEntries` into a neighbour.
4. **Refine** each segment's offset to the median boundary difference of the reference spans it
   landed on, sharpening it off the coarse grid.
5. **Pick** the best candidate across ratios — see *Model selection* below.

**Why the split penalty exists.** Without a cost per split the optimum is degenerate: give every
entry its own offset, snap each to its nearest neighbour, score perfectly, describe nothing. The
penalty buys "as few cuts as the data actually demands".

**Why `mergeShortRuns` exists.** A one-entry island is never a real cut — a cut shifts everything
*after* it. Without this, a single long entry with no counterpart pays for its own segment: the
Office fixture's 10.7-second translator credit did exactly that, because relocating it recovered more
overlap than the 7 s penalty cost.

### Stage 4 — `retime`

Applies the warp, then runs a mandatory repair pass:

```
start[i] >= start[i-1]
end[i]   >= start[i] + minDurationMs
end[i-1] <= start[i] - minGapMs
```

A later entry is never pushed backwards to satisfy an earlier one; the earlier one is truncated
instead. Truncating is visually harmless, moving an entry off its dialogue is not.

**Inherited overlaps are preserved.** Real subtitles legitimately overlap when two speakers are on
screen at once — the Office fixture has eight such pairs, one with two identical spans. `repair()`
takes the original entries so it can tell an inherited overlap from one that retiming introduced, and
only fixes the latter. Squashing the former would change what the file means.

---

## Model selection

Every framerate ratio gets a full fit; the best scoring candidate wins, with two corrections that
real fixtures forced.

**Ratios are ranked by a full fit, not a proxy.** An earlier version ranked ratios by their best
*single* offset and fitted only the top two. That collapses exactly when it matters: with a 45 s cut
no single offset explains the file, so the correct ratio scores low and loses to a stretch that
happens to line up somewhere. It also bought nothing — the proxy cost a full `n × K` sweep, the same
as the fit.

**Scores are normalised by scaled duration.** Scaling the target stretches every entry, so a ratio of
1.04 inflates the overlap available by ~4 % before any alignment happens. Raw millisecond scores
therefore reward stretching for its own sake: two *further* stretches of an already-stretched file
outscored the ratio that actually corrected it.

**Near-ties are broken by simplicity.** A framerate error is closely approximated by a handful of
piecewise shifts — a 4.27 % rate error scored 799 956 under scale 1 with four segments against
798 264 under the true ratio with one. Within `TIE_MARGIN` (2 %) the simpler model wins: fewer
segments first, then no-stretch over stretch.

---

## Known limit: sub-second steps

**Stage 1 cannot resolve shifts much smaller than an entry is long.** Area overlap saturates: a 400 ms
error on a 2.5 s entry still overlaps 84 % of it.

Measured on the `multi-segments` fixture, which injects five segments stepping by −400, −1300, −400
and −1500 ms:

| Model | Overlap | Splits | Score |
|---|---|---|---|
| True 5-segment | 798 246 | 4 | 770 246 |
| Found 2-segment | 794 261 | 1 | **787 261** |

The truth scores **17 015 worse**. It buys only 3 985 ms of extra overlap — not enough to pay for even
one 7 000 ms split. The DP is correct; the objective cannot see these steps. Stage 1 reliably finds
the two *large* steps and merges over the two 400 ms ones.

Resolving them needs the text, which is Stage 2's job.

### A rejected alternative

A start-proximity objective — reward closeness to the nearest reference start instead of area overlap
— does separate these models correctly (true model **+31 703** instead of −17 015), and start times
are arguably the better signal anyway since end times vary with each translator's reading-speed rules.

It was implemented and backed out. At every tolerance tried it failed elsewhere: at 2000 ms a spurious
45-second segment appeared in *all* fixtures, because with 513 reference starts over 1230 s the mean
spacing is only ~2.4 s, so almost any offset finds some start nearby. Below 400 ms it merged
everything. Revisit it alongside Stage 2, where text can disambiguate.

---

## Complexity

Let `n` = target entries, `K` = `maxCandidateOffsets`, `Ratios` = framerate ratios scanned.

* Candidate generation: `O(n · w)` per ratio, `w` = reference entries within `maxOffsetMs`
* Fit: `O(n · K)` per ratio — the DP's "best previous offset that is not this one" comes from the
  best and second-best of the previous row, so it stays `O(1)` per cell
* Total: `O(Ratios · n · K)`

Measured: ~180 ms for a 475-entry episode against 513 reference entries, scanning 9 ratios.

---

## Tuning

| Config key | Default | Effect |
|---|---|---|
| `splitPenaltyMs` | `7000` | Alignment a new segment must recover to be worth creating. Lower it for more cuts — but below ~1000 it degenerates into spurious far-away matches |
| `maxOffsetMs` | `180000` | Largest shift considered. Narrowing it reduces spurious matches |
| `minSegmentEntries` | `3` | Shortest run that may be its own segment |
| `minConfidence` | `0.25` | Below this the result is still written, but reported as a weak match |

Confidence is achieved overlap divided by total target duration. A good match on real fixtures scores
around 0.96; unrelated inputs fall below 0.3.
