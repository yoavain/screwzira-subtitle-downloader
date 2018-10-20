# screwzira-subtitle-downloader

CLI for downloading Hebrew subtitles from screwzira.com using their API

<br>Usage example:
<br>screwzira-downloader.exe input <video-file-full-path>
<br>Quiet mode:
<br>screwzira-downloader.exe input <video-file-full-path> quiet
<br>Sonarr mode:
<br>screwzira-downloader.exe input sonarr

<br>Usage (legacy):
<br>screwzira-downloader.exe <video-file-full-path>

<br>Installer now adds right-click to folders and to .mkv/.avi/.mp4 files

---

## Configuring sonarr:

![sonarr configuration](https://raw.githubusercontent.com/yoavain/screwzira-subtitle-downloader/master/resources/screenshots/sonarr-custom-script.png)

<br>In order to have Silent launch of the downloader:
<br>Path should be to the launcher: "C:\Program Files\Screwzira-Downloader\screwzira-downloader-launcher.exe"
<br>Arguments should be: "C:\Program Files\Screwzira-Downloader\screwzira-downloader.exe" sonarr quiet

---

## To build:

 * install nsis
 * npm install -g nexe
 * npm install
 * npm run build

