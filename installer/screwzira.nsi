!define PRODUCT_NAME "Screwzira-Downloader"
!define PRODUCT_VERSION "1.0.1"
!define PRODUCT_PUBLISHER "yoavain"
!define PRODUCT_WEB_SITE "https://github.com/yoavain/screwzira-subtitle-downloader"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_NAME}.exe"
Var ProgID

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${PRODUCT_NAME}_${PRODUCT_VERSION}_Setup.exe"
LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""

DirText " "
ShowInstDetails show
ShowUnInstDetails show
Section "Main"
SetOutPath "$INSTDIR"
File "..\dist\screwzira-downloader.exe"
File "..\dist\SnoreToast.exe"
WriteRegStr HKCR "Folder\shell\${PRODUCT_NAME}\command" "" '$INSTDIR\screwzira-downloader.exe "%1"'
ReadRegStr $ProgID HKLM "SOFTWARE\Classes\.mkv" ""
WriteRegStr HKLM "SOFTWARE\Classes\$ProgID\shell\${PRODUCT_NAME}\command" "" '$INSTDIR\screwzira-downloader.exe "%1"'
WriteUninstaller "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_NAME}.exe"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_NAME}.exe"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd
Section "Uninstall"
Delete "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
Delete "$INSTDIR\screwzira-downloader.exe"
Delete "$INSTDIR\SnoreToast.exe"
RMDir "$INSTDIR"
DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
DeleteRegKey HKCR "Folder\shell\${PRODUCT_NAME}"
ReadRegStr $ProgID HKLM "SOFTWARE\Classes\.mkv" ""
DeleteRegKey HKLM "SOFTWARE\Classes\$ProgID\shell\${PRODUCT_NAME}"
SetAutoClose true
SectionEnd