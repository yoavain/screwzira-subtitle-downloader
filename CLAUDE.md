# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Windows CLI tool and context-menu application for downloading Hebrew subtitles from [ktuvit.me](https://ktuvit.me). Supports individual video files, directories, and Sonarr integration. Produces a standalone `.exe` via Node.js Single Executable Application (SEA).

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

Instantiates all components and defines the main flow:
1. Parse CLI args → determine input path (single file or directory, or Sonarr env var)
2. Check if subtitle already exists for the file
3. Classify the file (movie vs. TV episode) via `Classifier`
4. Delegate to `KtuvitParser.handleMovie()` or `handleEpisode()`
5. Save the downloaded `.srt` file alongside the video

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
| `src/argsParser.ts` | CLI arg parsing; supports `input <path>`, `sonarr`, `quiet` modes |
| `src/config.ts` | Reads/writes JSON config; supports `logLevel`, `extensions`, `replacePairs`, `languageCode` |
| `src/notifier.ts` | Windows toast notifications via SnoreToast (bundled in `dist/`) |
| `src/logger.ts` | Winston-based logger writing to ProgramData log file |
| `src/parsers/ktuvit/tvShowIdCache.ts` | Flat-cache persistence for TV series IDs (avoids repeated lookups) |
| `src/parsers/ktuvit/ktuvitSiteUtils.ts` | HTML/JSON response parsing for Ktuvit.me API |

### Path Aliases

TypeScript and Jest both resolve these aliases:
- `~src/*` → `src/*`
- `~test/*` → `test/*`
- `~resources/*` → `resources/*`

### Build Pipeline

1. **webpack** — bundles `src/index.ts` to `_build/index.js` using `tsconfig.build.json`; injects credentials as compile-time constants via `DefinePlugin`; copies `snoretoast-x64.exe`, launcher, and notification icons to `dist/`
2. **node-sea** — uses Node.js SEA (`sea-config.json`) to produce a self-contained `dist/ktuvit-downloader.exe`: builds a blob from `_build/index.js`, copies `node.exe`, removes its signature, injects the blob, re-signs with SHA256
3. **launcher** — a tiny C# shim (`launcher/launcher.cs`) compiled to `dist/ktuvit-downloader-launcher.exe`; its only job is to start `ktuvit-downloader.exe` with `ProcessWindowStyle.Hidden` so no console window appears when launched from Explorer's right-click menu. Built via `msbuild launcher/launcher.csproj`; the pre-commit hook rebuilds it automatically when `launcher.cs` changes.
4. **installer** — NSIS script (`installer/ktuvit.nsi`) producing `Ktuvit-Downloader_<version>_Setup.exe`; installs to `%PROGRAMFILES64%\Ktuvit-Downloader\` and writes registry keys under `HKLM\SOFTWARE\Classes\` to add a **"Ktuvit-Downloader"** right-click context menu entry to:
   - Folders (`Folder\shell\...`) — passing the folder path as `input "%1"`
   - `.mkv`, `.avi`, `.mp4` files (`SystemFileAssociations\.<ext>\shell\...`) — passing the file path as `input "%1"`

   All context menu commands invoke the **launcher** (not the main exe) to keep the invocation windowless. The uninstaller removes all files and deletes all registry keys.

### Pre-commit Hook

The hook (`.husky/pre-commit`) runs `lint-staged` (eslint on `.ts`/`.js`, prettier on `.json`) and rebuilds the C# launcher if it changed.

## Test Structure

Tests live in `test/` and mirror `src/`. Mocks are in `test/__mocks__/` and provide stub implementations of `logger`, `notifier`, `config`, and the main `index` module. Coverage is collected for all `src/**/*.ts` except `src/index.ts`.
