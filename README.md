# ![](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/master/resources/icons/sz-64.png) Screwzira Subtitle Downloader  <br>![types](https://img.shields.io/npm/types/typescript.svg) ![commit](https://img.shields.io/github/last-commit/yoavain/screwzira-subtitle-downloader.svg) [![Known Vulnerabilities](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader/badge.svg?targetFile=package.json)](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader?targetFile=package.json) ![dependabot](https://api.dependabot.com/badges/status?host=github&repo=yoavain/screwzira-subtitle-downloader)

## A tool for downloading Hebrew subtitles from screwzira.com using their API
Installer adds right-click context to folders and to mkv/avi/mp4 file types.


### Usage: 
![sonarr configuration](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/master/resources/screenshots/right-click-usage.gif)

### CLI:
Usage example:  
```
screwzira-downloader.exe input <video-file-full-path>
```  

Quiet mode (no notification):  
```
screwzira-downloader.exe input <video-file-full-path> quiet
```
  
Sonarr mode (input file path is taken from environment variable: SONARR_EPISODE_FILE_PATH):
```
screwzira-downloader.exe input sonarr  
```

<details><summary>Usage (legacy)</summary>
<p>

```
screwzira-downloader.exe <video-file-full-path>
```
</p>
</details>

---

## Configuring sonarr:

![sonarr configuration](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/master/resources/screenshots/sonarr-custom-script.png)

In order to have Silent launch of the downloader:  
Path should be to the launcher: "C:\Program Files\Screwzira-Downloader\screwzira-downloader-launcher.exe"  
Arguments should be: sonarr quiet

---

## To build:

 * npm install
 * npm run build
