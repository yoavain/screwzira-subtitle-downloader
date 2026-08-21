# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Windows CLI tool and context-menu application for downloading Hebrew subtitles from [ktuvit.me](https://ktuvit.me). Supports individual video files, directories, and Sonarr integration. Produces a standalone `.exe` via Node.js Single Executable Application (SEA).

### Two disjoint flows

The app has two flows, chosen by what the user right-clicks. They share no invocation and no code path.

| | **Flow A — Download** | **Flow B — Sync** |
|---|---|---|
| Right-click target | video (`.mkv` `.avi` `.mp4`) or folder | subtitle (`.srt`) |
| Menu entry | `Ktuvit-Downloader` | `Sync subtitle (Beta)` |
| CLI | `input "<path>"` | `sync input "<path.srt>"` |
| What it does | find and download a Hebrew subtitle | re-time an existing subtitle against a reference |
| AI | none | none today — planned for Stage 2 |

Flow B is dispatched at the top of `main()` and returns, so nothing in the sync pipeline can affect the download path. Sync targets the subtitle directly rather than deriving it from a video filename, which also means it works on subtitles this tool did not download.

## Commands

```bash
npm install          # Install dependencies (also installs husky hooks)
npm run build        # Full build: lint → type-check → test → webpack → node-sea → installer
npm run quick-build-exe  # Fast rebuild: webpack + node-sea only (skips lint/test/installer)
npm run eslint       # Lint src/ test/ *.ts
npm run eslint:fix   # Lint with auto-fix
npm run type-check   # TypeScript type checking (noEmit)
npm run test         # Run all Jest tests
npm run webpack      # Bundle src → _build/index.js
npm run start        # Run via ts-node (dev mode)
```

**Run a single test file:**
```bash
npx jest test/classifier.test.ts
```

**Run tests matching a pattern:**
```bash
npx jest -t "pattern"
```

## Credentials Required for Build

`KTUVIT_EMAIL` and `KTUVIT_PASSWORD` must be set in a `.env` file at the project root. The webpack build bakes these credentials directly into the bundled `.exe`. The `.env` file must exist before running `npm run webpack` or `npm run build`.

## Architecture

### Entry Point & Wiring (`src/index.ts`)

Instantiates all components and dispatches on mode:

1. Parse CLI args.
2. **Sync mode** (`argsParser.isSync()`) → build `ReferenceSourceFinder` + `SubtitleSyncer`, call `sync(srtPath)`, return. The download code below never runs.
3. **Download mode** → determine input path (single file, directory, or Sonarr env var). For each video file, delegate to `handleSingleFile` (`src/singleFileHandler.ts`):
   - Check if a Hebrew subtitle already exists on disk
   - Check for embedded Hebrew subtitles in MKV (only when `checkEmbeddedSubtitles` is enabled — it defaults to `false`)
   - Classify the file (movie vs. TV episode) via `Classifier`
   - Delegate to `KtuvitParser.handleMovie()` or `handleEpisode()`

Runtime data lives in `%ProgramData%\Ktuvit-Downloader\` (config JSON, log file, TV show ID cache).

### Classifier (`src/classifier.ts`)

Uses regex to classify filenames:
- Episode regex: matches `SxxExx` / `NxNN` patterns
- Movie regex: matches `Title YYYY` patterns
- Falls back to parent folder name for movies

Similarity matching uses weighted word scoring (`WORD_WEIGHTS`) to pick the best subtitle from multiple candidates.

### Parser Hierarchy

- `ParserInterface` — `handleMovie()` / `handleEpisode()`
- `CommonParser` — base class with `findClosestMatch()` and HTTP error handling
- `KtuvitParser extends CommonParser` — Ktuvit.me API client: login → search → get subtitles list → request download token → download file

### Key Components

| File | Purpose |
|------|---------|
| `src/argsParser.ts` | CLI arg parsing; supports `input <path>`, `sonarr`, `quiet`, `sync` modes; `getMkvtoolnixDir()` resolves the bundled binary folder |
| `src/config.ts` | Reads/writes JSON config; owns the `SyncConfig` type. Fields: `logLevel`, `extensions`, `replacePairs`, `languageCode`, `checkEmbeddedSubtitles`, plus sync fields (`referenceLanguages`, `splitPenaltyMs`, `maxOffsetMs`, `minSegmentEntries`, `minConfidence`, `ollamaBaseUrl`, `syncEmbeddingModel`) |
| `src/singleFileHandler.ts` | Core single-file logic: subtitle-exists check → embedded-subtitle check → classify → parser dispatch |
| `src/notifier.ts` | Windows toast notifications via SnoreToast (bundled in `dist/`) |
| `src/logger.ts` | Winston-based logger writing to ProgramData log file |
| `src/parsers/ktuvit/tvShowIdCache.ts` | Flat-cache persistence for TV series IDs (avoids repeated lookups) |
| `src/parsers/ktuvit/ktuvitSiteUtils.ts` | HTML/JSON response parsing for Ktuvit.me API |

#### Sync pipeline (`src/sync/`)

Sync is a four-stage pipeline. Only Stage 2 will ever involve AI, and it is not built yet — see [`docs/sync-algorithm.md`](docs/sync-algorithm.md) for the algorithm and its known limits.

| File | Purpose |
|------|---------|
| `src/sync/types.ts` | `SubtitleEntry`, `TimeSpan`, `Segment`, `TimeWarp` interfaces |
| `src/sync/subtitleParser.ts` | `parseSrt()`, `stripFormattingTags()` |
| `src/sync/subtitleWriter.ts` | `writeSrt()`, `formatTimestamp()` |
| `src/sync/mkvExtractor.ts` | `MkvExtractor` — runs `mkvmerge -J` and `mkvextract`. `findSubtitleTrack(path, languages)` is language-parameterised with ISO 639-2/639-3/BCP-47 alias matching; used for both embedded Hebrew detection and reference extraction |
| `src/sync/referenceSourceFinder.ts` | Given the target `.srt`, derives the stem, locates the video, and resolves a reference — embedded track first, then sidecar; French before English |
| `src/sync/syncGates.ts` | `GateFailure` reasons; `canUseEmbeddings()` for the soft Ollama gates |
| `src/sync/segmentFitter.ts` | `fitSegments()` — split-penalty DP over (item × candidate offset); `mergeShortRuns()` folds islands that are too short to be a real cut |
| `src/sync/timeWarp.ts` | **Stage 1** — builds candidate offsets, scans framerate ratios, fits segments, refines offsets. No AI, no text |
| `src/sync/retimer.ts` | **Stage 4** — `retime()` applies the warp; `repair()` fixes monotonicity and overlaps introduced by retiming |
| `src/sync/subtitleSyncer.ts` | `SubtitleSyncer` — orchestrates gates → Stage 1 → Stage 4 → backup → write |
| `src/sync/ollamaClient.ts` | `OllamaClient` — fetch wrapper for Ollama. Unused on the current path; retained for Stage 2 |

**Invariants the sync pipeline must never break:** subtitle text, entry order, and entry count are immutable. Only timings change. The original is always copied to `<name>.srt.bak` before the target is overwritten.

### Path Aliases

TypeScript and Jest both resolve these aliases:
- `~src/*` → `src/*`
- `~test/*` → `test/*`
- `~resources/*` → `resources/*`

### Build Pipeline

1. **webpack** — bundles `src/index.ts` to `_build/index.js` using `tsconfig.build.json`; injects credentials as compile-time constants via `DefinePlugin`; copies `snoretoast-x64.exe`, launcher, and notification icons to `dist/`
2. **node-sea** — uses Node.js SEA (`sea-config.json`) to produce a self-contained `dist/ktuvit-downloader.exe`: builds a blob from `_build/index.js`, copies `node.exe`, removes its signature, injects the blob, re-signs with SHA256
3. **launcher** — a tiny C# shim (`launcher/launcher.cs`) compiled to `dist/ktuvit-downloader-launcher.exe`; its only job is to start `ktuvit-downloader.exe` with `ProcessWindowStyle.Hidden` so no console window appears when launched from Explorer's right-click menu. Built via `msbuild launcher/launcher.csproj`; the pre-commit hook rebuilds it automatically when `launcher.cs` changes.
4. **installer** — NSIS script (`installer/ktuvit.nsi`) producing `Ktuvit-Downloader_<version>_Setup.exe`; installs to `%PROGRAMFILES64%\Ktuvit-Downloader\` and writes registry keys under `HKLM\SOFTWARE\Classes\`:
   - **"Ktuvit-Downloader"** (download) on folders (`Folder\shell\...`) and on `.mkv` / `.avi` / `.mp4` (`SystemFileAssociations\.<ext>\shell\...`) — passing the path as `input "%1"`
   - **"Sync subtitle (Beta)"** (`SEC07`, `${PRODUCT_SYNC_NAME}`) on `.srt` only — passing the path as `sync input "%1"`

   All context menu commands invoke the **launcher** (not the main exe) to keep the invocation windowless. The uninstaller removes all files and deletes all registry keys, including the pre-split sync keys that used to sit on folders and video types.

   `webpack` also copies `resources/mkvtoolnix/` to `dist/mkvtoolnix/`, which `SEC06` installs with `File /r`. Note `dist/` is not cleaned between builds, so stale files there get shipped.

### Pre-commit Hook

The hook (`.husky/pre-commit`) runs `lint-staged` (eslint on `.ts`/`.js`, prettier on `.json`) and rebuilds the C# launcher if it changed.

## Scripts

One-off and utility scripts live in `scripts/`. Conventions:

- Written in **TypeScript**
- Begin with a comment block describing what the script does and how to run it
- Run from the **project root** using:
  ```bash
  node -r ts-node/register/transpile-only ./scripts/<script-name>.ts
  ```

### Conventions for scripts using mkvtoolnix binaries

- Scripts must use **relative imports** (e.g. `../src/...`) — never `~src/` path aliases. `ts-node` does not resolve tsconfig path aliases.
- Scripts must **not** reinvent binary-calling logic inline. Any logic that shells out to `mkvmerge` or `mkvextract` must live in `src/` (e.g. `src/sync/mkvExtractor.ts`) and be imported.
- Use a general `MKVTOOLNIX_DIR` constant for the directory, then derive specific binary path constants from it:
  ```ts
  const MKVTOOLNIX_DIR  = path.join(__dirname, "..", "resources", "mkvtoolnix");
  const MKVMERGE_PATH   = path.join(MKVTOOLNIX_DIR, "mkvmerge.exe");
  const MKVEXTRACT_PATH = path.join(MKVTOOLNIX_DIR, "mkvextract.exe");
  ```

## Documentation

| Doc | Contents |
|---|---|
| [`docs/flow-charts.md`](docs/flow-charts.md) | Mermaid diagrams of both flows, the gates, and the stages |
| [`docs/sync-algorithm.md`](docs/sync-algorithm.md) | The sync algorithm, its prior art, model selection, and known limits |
| [`docs/testing-sync.md`](docs/testing-sync.md) | Fixture corpus, how to add a case, the read-only rule |
| `docs/plan/` | Design plans. Scratch artifacts — **never staged or committed** |

**After any change that affects control flow, verify the diagrams in `flow-charts.md` are still accurate and update them if needed.** Likewise, if you change the sync objective, the split penalty, or the model-selection rules, update `sync-algorithm.md` — it records measured numbers that justify those choices, and stale numbers there are worse than none.

## Test Structure

Tests live in `test/` and mirror `src/`. Mocks are in `test/mocks/` (exported via `test/mocks/index.ts`) and provide stub implementations of `logger`, `notifier`, `config`, and the main `index` module. Coverage is collected for all `src/**/*.ts` except `src/index.ts`.

Sync tests live in `test/sync/`. See [`docs/testing-sync.md`](docs/testing-sync.md) for the fixture corpus and how to add a case.

> `jest.config.ts` uses `testRegex: "test/.*.test.ts$"`, so `*.integration.test.ts` files **are** collected by `npm test`. They stay green only because each wraps itself in `describe.skip` unless its environment variable is set (e.g. `OLLAMA_INTEGRATION`). Do not rely on the filename to exclude a test — add the env guard.

### Sync fixtures are read-only

Fixture `.srt` files under `test/resources/sync/` are **inputs and must never be modified**. The sync pipeline writes in place — it overwrites the target and drops a `.bak` beside it — so any test that runs the syncer must use `copyCaseToTmp()` from `test/sync/fixtures.ts`. Suites that touch fixtures assert the tree is byte-identical afterwards via `expectFixturesUnchanged()`. `.gitattributes` marks `test/resources/sync/cases/**` as `-text` so line-ending conversion cannot alter them either.
