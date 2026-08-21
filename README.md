# ![](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/main/resources/icons/ktuvit-64.png) Ktuvit Subtitle Downloader  <br>

[![CodeQL](https://github.com/yoavain/screwzira-subtitle-downloader/workflows/CodeQL/badge.svg)](https://github.com/yoavain/screwzira-subtitle-downloader/actions?query=workflow%3ACodeQL)
[![Actions Status](https://github.com/yoavain/screwzira-subtitle-downloader/workflows/Node%20CI/badge.svg)](https://github.com/yoavain/screwzira-subtitle-downloader/actions)
![types](https://img.shields.io/npm/types/typescript.svg)
![commit](https://img.shields.io/github/last-commit/yoavain/screwzira-subtitle-downloader.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader/badge.svg?targetFile=package.json)](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader?targetFile=package.json)
[![codecov](https://codecov.io/gh/yoavain/screwzira-subtitle-downloader/branch/main/graph/badge.svg)](https://codecov.io/gh/yoavain/screwzira-subtitle-downloader)
[![Renovate](https://img.shields.io/badge/renovate-enabled-brightgreen.svg)](https://renovatebot.com)
![visitors](https://visitor-badge.glitch.me/badge?page_id=yoavain.screwzira-subtitle-downloader)

## A tool for downloading Hebrew subtitles from ktuvit.me

The installer adds two right-click entries:

| Right-click on | Entry | What it does |
|---|---|---|
| a folder, or an `.mkv` / `.avi` / `.mp4` file | **Ktuvit-Downloader** | downloads a Hebrew subtitle |
| an `.srt` file | **Sync subtitle (Beta)** | re-times that subtitle against a French or English reference |

The two are independent. Sync works on any `.srt`, including subtitles this tool did not download.

### Usage:

![sonarr configuration](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/main/resources/screenshots/right-click-usage.gif)

### CLI:

Usage example:

```
ktuvit-downloader.exe input <video-file-full-path>
```  

Quiet mode (no notification):  
```
ktuvit-downloader.exe input <video-file-full-path> quiet
```
  
Sonarr mode (input file path is taken from environment variable: SONARR_EPISODE_FILE_PATH):
```
ktuvit-downloader.exe sonarr
```

Sync mode — re-times an existing subtitle against a French or English reference.
The argument is the **subtitle** to fix, not the video:
```
ktuvit-downloader.exe sync input <subtitle-file-full-path.srt>
```

<details><summary>Usage (legacy)</summary>
<p>

```
ktuvit-downloader.exe <video-file-full-path>
```
</p>
</details>

---

## Configuring sonarr:

![sonarr configuration](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/main/resources/screenshots/sonarr-custom-script.png)

In order to have Silent launch of the downloader:  
Path should be to the launcher: "C:\Program Files\Ktuvit-Downloader\ktuvit-downloader-launcher.exe"  
Arguments should be: sonarr quiet

---

---

## Subtitle Sync (Beta)

Right-click a `.srt` and choose **Sync subtitle (Beta)**. It shifts the subtitle so it lines up with
the video, using a correctly-timed subtitle in another language as the reference.

**No AI and no setup required.** Sync compares only the *timing pattern* of the two subtitle files —
both light up when someone speaks and go dark during silence, and that rhythm is distinctive enough to
find the offset. It never reads the text, so it works regardless of language.

### What it can fix

 * a constant offset (the common case)
 * a framerate mismatch, e.g. subtitles made for 23.976 fps played at 25 fps
 * cuts — ad breaks or a different edit — where each part of the file needs a different shift

It cannot reliably fix shifts smaller than about half a second, because subtitle lines are seconds
long and a small shift still overlaps almost completely. Resolving those needs to compare the actual
text, which is planned but not built.

### Finding the reference

Given `Movie.Hebrew.srt`, it looks for a reference in this order:

 1. a **French** or **English** subtitle track embedded in `Movie.mkv`, extracted automatically
    (French first — it marks grammatical gender like Hebrew, which will matter for text matching later)
 2. a sidecar file: `Movie.fr.srt`, `.fra`, `.fre`, `.french`, then `.en`, `.eng`, `.english`

A video file is not required — a sidecar reference alone is enough. If the `.srt` lives in a `Subs/`
folder, the parent folder is searched too.

### Safety

The original is always copied to `<name>.srt.bak` before anything is written, and the subtitle **text**
is never touched — only the timings. If no reference is found, nothing is written at all and you get a
notification saying so.

---

<details><summary>Advanced configuration</summary>
<p>
Configuration json file is located under the %ProgramData%\Ktuvit-Downloader folder.<br>
 * You can change the log level<br>
 * You can configure replacement pairs (useful for series name mismatch)<br>
 * You can skip downloading when the MKV already contains a Hebrew subtitle track (<code>checkEmbeddedSubtitles</code>)<br>
 * You can tune subtitle sync<br>

 example:
 ```json
{
	"logLevel": "verbose",
	"replacePairs": {
		"The Handmaids Tale": "The Handmaid's Tale"
	},
	"checkEmbeddedSubtitles": false,
	"referenceLanguages": ["fr", "en"],
	"splitPenaltyMs": 7000,
	"maxOffsetMs": 180000,
	"minSegmentEntries": 3,
	"minConfidence": 0.25
}

```

| Key | Default | Meaning |
|---|---|---|
| `checkEmbeddedSubtitles` | `false` | Before downloading, skip the file if the MKV already has a Hebrew subtitle track |
| `referenceLanguages` | `["fr", "en"]` | Reference priority for sync, for both embedded tracks and sidecar files |
| `splitPenaltyMs` | `7000` | How much alignment a cut must recover to be worth introducing. Raise it to get fewer cuts, lower it for more |
| `maxOffsetMs` | `180000` | Largest shift considered |
| `minSegmentEntries` | `3` | A run shorter than this is treated as an outlier, not a real cut |
| `minConfidence` | `0.25` | Below this, the result is still written but flagged as a weak match |

The generated config also contains `ollamaBaseUrl` and `syncEmbeddingModel`. Both are reserved for a
future text-matching stage and have no effect today — sync currently uses no AI.

</p>
</details>

<details><summary>Log</summary>
<p>
Log file is located under the %ProgramData%\Ktuvit-Downloader folder.<br>  
 * You can use it to find a reason for why subtitles that are available in the website, are not being downloaded<br> 

</p>
</details>

## To build:

 * npm install
 * npm run build
