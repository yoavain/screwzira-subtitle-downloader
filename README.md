# ![](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/master/resources/icons/sz-64.png) Screwzira Subtitle Downloader  <br>

[![Total alerts](https://img.shields.io/lgtm/alerts/g/yoavain/screwzira-subtitle-downloader.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/yoavain/screwzira-subtitle-downloader/alerts/)
[![Language grade: JavaScript](https://img.shields.io/lgtm/grade/javascript/g/yoavain/screwzira-subtitle-downloader.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/yoavain/screwzira-subtitle-downloader/context:javascript)
[![Actions Status](https://github.com/yoavain/screwzira-subtitle-downloader/workflows/Node%20CI/badge.svg)](https://github.com/yoavain/screwzira-subtitle-downloader/actions)
![types](https://img.shields.io/npm/types/typescript.svg)
![commit](https://img.shields.io/github/last-commit/yoavain/screwzira-subtitle-downloader.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader/badge.svg?targetFile=package.json)](https://snyk.io//test/github/yoavain/screwzira-subtitle-downloader?targetFile=package.json)
[![codecov](https://codecov.io/gh/yoavain/screwzira-subtitle-downloader/branch/master/graph/badge.svg)](https://codecov.io/gh/yoavain/screwzira-subtitle-downloader)
![renovate](https://badges.renovateapi.com/github/yoavain/screwzira-subtitle-downloader)
![visitors](https://visitor-badge.glitch.me/badge?page_id=yoavain.screwzira-subtitle-downloader)

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

<details><summary>Advanced configuration</summary>
<p>
Configuration json file is located under the %ProgramData%\Screwzira-Downloader folder.<br>  
 * You can change the log level<br>
 * You can configure replacement pair (useful for series name mismatch)<br>
 
 example:
 ```json
{
	"logLevel": "verbose",
	"replacePairs": {
		"The Handmaids Tale": "The Handmaid's Tale"
	}
}

```
</p>
</details>

<details><summary>Log</summary>
<p>
Log file is located under the %ProgramData%\Screwzira-Downloader folder.<br>  
 * You can use it to find a reason for why subtitles that are available in the website, are not being downloaded<br> 

</p>
</details>

## To build:

 * npm install
 * npm run build
