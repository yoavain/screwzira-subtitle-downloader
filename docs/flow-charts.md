# Flow Charts

> After any code change that affects the application flow, verify these diagrams are still accurate.

The application has two **disjoint** flows, selected by what the user right-clicks. They share no
invocation and no code path.

| | Flow A — Download | Flow B — Sync |
|---|---|---|
| Right-click target | video (`.mkv` `.avi` `.mp4`) or folder | subtitle (`.srt`) |
| Menu entry | `Ktuvit-Downloader` | `Sync subtitle (Beta)` |
| CLI | `input "<path>"` | `sync input "<path.srt>"` |

---

## 1. Main Entry Flow

```mermaid
flowchart TD
    A([CLI invoked]) --> B[Parse args]
    B --> S{sync mode?}
    S -- Yes --> S1{Input provided?}
    S1 -- No --> S2([Notify: missing subtitle file<br/>End])
    S1 -- Yes --> S3[subtitleSyncer.sync<br/>see chart 5]
    S -- No --> C{Input provided?}
    C -- No --> C1([Notify: Missing input<br/>Print usage<br/>End])
    C -- Yes --> D{Path is<br/>directory?}
    D -- Yes --> E[handleFolder<br/>recurse into sub-folders]
    D -- No --> F[handleSingleFileLocal]
    D -- ENOENT --> F
    E --> F
```

Sync is dispatched at the top of `main()` and returns. Nothing in the sync pipeline can affect the
download path below it.

---

## 2. Single File Handler (Flow A)

```mermaid
flowchart TD
    A([handleSingleFileLocal<br/>fullpath]) --> B{Hebrew .srt<br/>already exists<br/>on disk?}
    B -- Yes --> B1([Notify: subtitles already exist<br/>Return false])
    B -- No --> B2{embeddedSubtitleChecker<br/>provided?}
    B2 -- No --> C
    B2 -- Yes --> B3{checkEmbeddedSubtitles<br/>enabled AND .mkv?}
    B3 -- No --> C
    B3 -- Yes --> B4["MkvExtractor.hasSubtitleTrack(path, ['he'])"]
    B4 --> B5{Hebrew text<br/>track found?}
    B5 -- Yes --> B6([Notify: embedded Hebrew subtitles found<br/>Return false])
    B5 -- No --> C
    C[Classify filename] --> D{Classification?}
    D -- Movie --> E[parser.handleMovie]
    D -- Episode --> F[parser.handleEpisode]
    D -- Unknown --> G([Notify: unable to classify<br/>Return false])
    E --> H([Return true — downloaded])
    F --> H
```

---

## 3. Ktuvit Download Pipeline

```mermaid
flowchart TD
    A([handleMovie / handleEpisode]) --> B[Login to ktuvit.me]
    B --> C[Search for title]
    C --> D{Results<br/>found?}
    D -- No --> D1([Notify: not found<br/>End])
    D -- Yes --> E[Get subtitles list<br/>for best match]
    E --> F[findClosestMatch<br/>weighted word scoring]
    F --> G{Match<br/>found?}
    G -- No --> G1([Notify: no subtitle match<br/>End])
    G -- Yes --> H[Request download token]
    H --> I[Download .srt file]
    I --> J[Save as<br/>filename.languageCode.srt]
    J --> K([Notify: success])
```

---

## 4. Folder Batch Handling (Flow A only)

```mermaid
flowchart TD
    A([handleFolder<br/>dir]) --> B[readDir]
    B --> C{For each item}
    C -- Is directory --> D[Recurse: handleFolder]
    D --> C
    C -- Is video file<br/>ext in config --> E{needToWait?}
    E -- Yes --> F[Sleep 3000ms]
    F --> G[handleSingleFileLocal]
    E -- No --> G
    G --> H{downloaded?}
    H -- Yes --> I[needToWait = true]
    H -- No --> C
    I --> C
    C -- Done --> J{Any file<br/>handled?}
    J -- No --> K([Notify: no file handled])
    J -- Yes --> L([Done])
```

Folders never trigger sync. Batch sync is deliberately not offered — a batch is mostly already in sync,
so syncing it eagerly is wasted work.

---

## 5. Sync Pipeline (Flow B)

```mermaid
flowchart TD
    A(["subtitleSyncer.sync(targetSrtPath)"]) --> G2{G2: target parses<br/>to >= 1 entry?}
    G2 -- No --> W([NOTIFY failure + stop<br/>file untouched, no .bak])
    G2 -- Yes --> G3[referenceSourceFinder.find<br/>see chart 6]
    G3 --> G3a{Reference found<br/>and non-empty?}
    G3a -- No --> W
    G3a -- Yes --> S1["Stage 1 — timeWarp<br/>split-penalty DP on timings<br/>NO AI, NO text"]
    S1 --> S4["Stage 4 — retime<br/>apply warp + repair pass"]
    S4 --> B[Copy target to .srt.bak]
    B --> C[Overwrite target .srt]
    C --> D{confidence >=<br/>minConfidence?}
    D -- Yes --> E([Notify: synced<br/>shift + cut count])
    D -- No --> F([Notify WARNING: match looks weak<br/>original is in the .bak])
```

Gates G4/G5 (Ollama reachable, embedding model pulled) arrive with Phase 3. They are **soft**: they
downgrade the bead scorer, they never stop the sync. Stages 2 and 3 — the bead DP and the segment
refit — slot between Stage 1 and Stage 4 without changing this shape.

---

## 6. Reference Source Resolution

```mermaid
flowchart TD
    A(["clicked Movie.Hebrew.srt"]) --> B[derive stem:<br/>strip one language/variant tag]
    B --> C[find sibling video:<br/>stem + mkv / mp4 / avi]
    C -- none --> C2{exactly one video<br/>in the folder?}
    C2 -- Yes --> D
    C2 -- No --> H
    C -- found --> D{video is .mkv?}
    D -- Yes --> E[mkvmerge -J]
    E --> F{text track in<br/>language priority order?}
    F -- Yes --> G{already extracted?}
    G -- Yes --> Z([reference ready — embedded])
    G -- No --> G1[mkvextract to stem.LANG.srt]
    G1 --> Z
    F -- No --> H[sidecar lookup]
    D -- No --> H
    H --> I{"stem.fr / .fra / .fre / .french .srt"}
    I -- found --> Z2([reference ready — sidecar])
    I -- none --> J{"stem.en / .eng / .english .srt"}
    J -- found --> Z2
    J -- none --> L{"wanted language present<br/>but image-based only?"}
    L -- Yes --> M(["G3 fails: report PGS/VobSub<br/>and suggest a sidecar"])
    L -- No --> K([G3 fails: no reference])
```

Notes:
- **French before English.** French marks grammatical gender like Hebrew, so a French line
  disambiguates its Hebrew counterpart more often. Priority is configurable.
- **Embedded before sidecar.** An embedded track is guaranteed to be timed against *this* video file;
  a sidecar may have been downloaded for a different release.
- The reference is never allowed to resolve to the clicked file itself.
- If the `.srt` sits in a `Subs/` or `Subtitles/` folder, the parent folder is searched too.
- Sync works with no video present — only the embedded path needs one.
- **Text codecs only** (`S_TEXT/UTF8`, `S_TEXT/ASS`, `S_TEXT/SSA`). Blu-ray `S_HDMV/PGS` and DVD
  `S_VOBSUB` tracks are pictures of text and need OCR, so they are rejected. When the wanted language
  exists *only* as such a track, `findSubtitleTrack` reports it via `bitmapOnlyLanguages` and the
  failure says "image-based, add a sidecar" rather than the misleading "no reference found".
  The full subtitle-track inventory is logged at DEBUG so the log always answers why.

---

## 7. Stage 1 — timeWarp (no AI, no text)

```mermaid
flowchart TD
    A([target spans, reference spans]) --> B[For each framerate ratio:<br/>scale target times]
    B --> C[Vote for candidate offsets:<br/>reference.start - target.start,<br/>weighted by entry duration]
    C --> D[Keep the top-voted offsets]
    D --> E[Rank ratios by best single offset]
    E --> F[For the top 2 ratios:<br/>split-penalty DP over<br/>item x offset]
    F --> G[mergeShortRuns:<br/>fold runs under<br/>minSegmentEntries]
    G --> H[Refine each segment offset<br/>to the median boundary difference]
    H --> I([segments + confidence])
```

The split penalty is what stops the fit degenerating: without a cost per split, the optimum gives every
entry its own offset, scores perfectly, and describes nothing. `mergeShortRuns` handles the related
case where one unusually long entry with no counterpart — a translator credit, a title card — can pay
for its own segment. A genuine cut shifts everything *after* it, so an island is an outlier.

---

## 8. Stage 4 — retime and repair

```mermaid
flowchart TD
    A([For each entry i]) --> B["Apply its segment:<br/>t -> t * scale + offset"]
    B --> C[Repair pass, in order]
    C --> D["start[i] >= start[i-1]"]
    D --> E["end[i] >= start[i] + minDurationMs"]
    E --> F{"end[i-1] > start[i] - minGapMs?"}
    F -- No --> H
    F -- Yes --> G{did the ORIGINAL<br/>overlap here?}
    G -- Yes --> H([keep — legitimate<br/>simultaneous speakers])
    G -- No --> I[truncate entry i-1,<br/>never move entry i]
    I --> H
```

The repair pass is a correctness requirement, not a polish step. Real subtitles legitimately overlap
when two speakers are on screen at once — the test fixture has eight such pairs, one with two identical
spans — so the pass distinguishes an inherited overlap from one that retiming introduced, and only
repairs the latter. Text, order, and entry count are never changed.
