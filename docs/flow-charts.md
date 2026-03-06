# Flow Charts

> After any code change that affects the application flow, verify these diagrams are still accurate.

---

## 1. Main Entry Flow

```mermaid
flowchart TD
    A([CLI invoked]) --> B[Parse args]
    B --> C{Input provided?}
    C -- No --> C1([Notify: Missing input\nPrint usage\nEnd])
    C -- Yes --> D{Path is\ndirectory?}
    D -- Yes --> E[handleFolder\nrecurse into sub-folders]
    D -- No --> F[handleSingleFileLocal]
    D -- ENOENT --> F
    E --> F
```

---

## 2. Single File Handler

```mermaid
flowchart TD
    A([handleSingleFileLocal\nfullpath]) --> B{Hebrew .srt\nalready exists\non disk?}
    B -- Yes --> B1([Notify: subtitles already exist\nReturn false])
    B -- No --> C[Classify filename]
    C --> D{Classification?}
    D -- Movie --> E[parser.handleMovie]
    D -- Episode --> F[parser.handleEpisode]
    D -- Unknown --> G([Notify: unable to classify\nReturn false])
    E --> H([Return true\ndownloaded])
    F --> H
    H --> I{isSync flag\nset?}
    I -- No --> Z([Done])
    I -- Yes --> J[subtitleSyncer.sync]
    J --> Z
```

---

## 3. Ktuvit Download Pipeline

```mermaid
flowchart TD
    A([handleMovie / handleEpisode]) --> B[Login to ktuvit.me]
    B --> C[Search for title]
    C --> D{Results\nfound?}
    D -- No --> D1([Notify: not found\nEnd])
    D -- Yes --> E[Get subtitles list\nfor best match]
    E --> F[findClosestMatch\nweighted word scoring]
    F --> G{Match\nfound?}
    G -- No --> G1([Notify: no subtitle match\nEnd])
    G -- Yes --> H[Request download token]
    H --> I[Download .srt file]
    I --> J[Save as\nfilename.languageCode.srt]
    J --> K([Notify: success])
```

---

## 4. Folder Batch Handling

```mermaid
flowchart TD
    A([handleFolder\ndir]) --> B[readDir]
    B --> C{For each item}
    C -- Is directory --> D[Recurse: handleFolder]
    D --> C
    C -- Is video file\next in config --> E{needToWait?}
    E -- Yes --> F[Sleep 3000ms]
    F --> G[handleSingleFileLocal]
    E -- No --> G
    G --> H{downloaded?}
    H -- Yes --> I[needToWait = true]
    H -- No --> C
    I --> C
    C -- Done --> J{Any file\nhandled?}
    J -- No --> K([Notify: no file handled])
    J -- Yes --> L([Done])
```

---

## 5. Sync Pipeline (when `--sync` flag is set)

```mermaid
flowchart TD
    A([subtitleSyncer.sync\nfullpath]) --> B[syncPreflightCheck]
    B --> C{syncEnabled\nin config?}
    C -- No --> C1([Skip sync — disabled])
    C -- Yes --> D{ollamaBaseUrl\nconfigured?}
    D -- No --> D1([WARN: ollamaBaseUrl not set\nSkip sync])
    D -- Yes --> E{GET /api/tags\nOllama reachable?}
    E -- No --> E1([WARN: Ollama not running\nSkip sync])
    E -- Yes --> F{POST /api/show\nModel available?}
    F -- No --> F1([WARN: Model not found\nhint: ollama pull\nSkip sync])
    F -- Yes --> G[Find English source]
    G --> H{.eng.srt\nexists?}
    H -- Yes --> K[Parse English SRT]
    H -- No --> I{File is .mkv?}
    I -- No --> I1([WARN: no English source\nSkip sync])
    I -- Yes --> J[MkvExtractor:\nmkvmerge -J → find English track\nmkvextract → .eng.srt]
    J --> J1{English stream\nfound?}
    J1 -- No --> J2([WARN: no English subtitle\nstream in MKV\nSkip sync])
    J1 -- Yes --> K
    K --> L[Parse Hebrew SRT]
    L --> M[SubtitleMatcher:\nmatch Hebrew ↔ English\nvia Ollama LLM in batches]
    M --> N[SceneDetector:\ngroup match pairs\nby offset delta threshold]
    N --> O[TimingCorrector:\napply per-chunk offsets]
    O --> P[Backup .heb.srt → .heb.srt.bak]
    P --> Q[Save corrected .heb.srt]
    Q --> R([Notify: sync complete])
```

---

## 6. LLM Subtitle Matching (batch loop)

```mermaid
flowchart TD
    A(["Hebrew lines [H1..Hn]\nEnglish lines [E1..Em]"]) --> B["Split into parallel batches of syncBatchSize:\nbatch b → hebEntries[b*N .. b*N+N]\n          engEntries[b*N .. b*N+N]"]
    B --> C{Either batch\nempty?}
    C -- Yes --> J([Full MatchTable])
    C -- No --> D[POST /api/chat to Ollama\nmap Hebrew → English indices]
    D --> E{HTTP/network\nerror?}
    E -- No --> G[Parse JSON from response]
    E -- Yes --> F[Retry once]
    F --> F2{Retry\nerror?}
    F2 -- Yes --> K[Return empty —\nno matches for batch\nWARN logged]
    F2 -- No --> G
    G --> H{JSON parse\nfailed?}
    H -- Yes --> K
    H -- No --> I[Map to MatchEntry array\nwith absolute indices\n+ compute offset]
    I --> L[Accumulate matches]
    K --> L
    L --> M{More batches?}
    M -- Yes --> C
    M -- No --> J
```

---

## 7. Timing Correction

```mermaid
flowchart TD
    A([For each Hebrew line Hi]) --> B{Match type?}
    B -- "1:1  Hi → Ej" --> C["new_start = hi.start + chunk_offset\nnew_end   = hi.end   + chunk_offset"]
    B -- "1:2 split  Hi → Ej, Ej+1" --> D["new_start = Ej.start\nnew_end   = Ej+1.end"]
    B -- "2:1 merge  Hi,Hi+1 → Ej" --> E["Hi:   start=Ej.start, end=Ej.midpoint\nHi+1: start=Ej.midpoint, end=Ej.end"]
    B -- Unmatched --> F[Keep original timing\nWARN: unmatched line]
    C --> G([Write corrected entry])
    D --> G
    E --> G
    F --> G
```
