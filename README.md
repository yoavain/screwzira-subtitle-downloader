# screwzira-subtitle-downloader

CLI for downloading Hebrew subtitles from screwzira.com using their API

Adding to right-click:

1) Identify the file type (ProgID) for .mkv files
Check the default value of HKEY_CLASSES_ROOT\.mkv.
It could be anything based on what you've installed, but for the purposes of this example, we'll call it "mplayerc64.mkv".

2) Set the context menu item (verb) properties for that file type
You can either set per-user context menu items or for all users.
Per-user:  HKEY_CURRENT_USER\Software\Classes\mplayerc64.mkv\shell
All users: HKEY_LOCAL_MACHINE\Software\Classes\mplayerc64.mkv\shell

3) Set the command value:
You need to set the default value of the command subkey. You need to set that with the path to this application, like so: HKEY_CURRENT_USER\Software\Classes\mplayerc64.mkv\shell\screwzira-subtitle-downloader\command would be set to "c:\path\to\screwzira-downloader.exe" "%1".
Now a context menu for .mkv files will have a "screwzira-subtitle-downloader" item which will launch this app and try to download subtitles.
