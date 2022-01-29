; Script generated by the HM NIS Edit Script Wizard.

Unicode True

; HM NIS Edit Wizard helper defines
!define PRODUCT_NAME "Ktuvit-Downloader"
!define PRODUCT_VERSION "$%BUILD_VERSION%"
!define PRODUCT_PUBLISHER "yoavain"
!define PRODUCT_WEB_SITE "https://github.com/yoavain/screwzira-subtitle-downloader"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\${PRODUCT_NAME}.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; MUI 1.67 compatible ------
!include "MUI.nsh"

; MUI Settings
!define MUI_ABORTWARNING
!define MUI_ICON "../resources/icons/ktuvit_install.ico"
!define MUI_UNICON "../resources/icons/ktuvit_uninstall.ico"

; MUI Settings / Header
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\orange-r-nsis.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "${NSISDIR}\Contrib\Graphics\Header\orange-uninstall-r-nsis.bmp"

; MUI Settings / Wizard
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\orange-nsis.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\orange-uninstall-nsis.bmp"

; Welcome page
!insertmacro MUI_PAGE_WELCOME
; Components page
!insertmacro MUI_PAGE_COMPONENTS
; Directory page
!insertmacro MUI_PAGE_DIRECTORY
; Instfiles page
!insertmacro MUI_PAGE_INSTFILES
; Finish page
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES

; Language files
!insertmacro MUI_LANGUAGE "English"

; MUI end ------

Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "${PRODUCT_NAME}_${PRODUCT_VERSION}_Setup.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show

Section "Main" SEC00
SetOutPath "$INSTDIR"
File "..\dist\ktuvit-downloader.exe"
File "..\dist\ktuvit-downloader-launcher.exe"
File "..\dist\snoretoast-x64.exe"
SectionEnd
Section "Icons" SEC01
SetOutPath "$INSTDIR\notif-icons"
File "..\dist\notif-icons\logo.png"
File "..\dist\notif-icons\download.png"
File "..\dist\notif-icons\not-found.png"
File "..\dist\notif-icons\failed.png"
File "..\dist\notif-icons\warning.png"
SectionEnd
Section "Directory" SEC02
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  WriteRegStr HKLM "SOFTWARE\Classes\Folder\shell\${PRODUCT_NAME}" "Icon" '$INSTDIR\ktuvit-downloader-launcher.exe,0'
  WriteRegStr HKLM "SOFTWARE\Classes\Folder\shell\${PRODUCT_NAME}\command" "" '"$INSTDIR\ktuvit-downloader-launcher.exe" input "%1"'
SectionEnd
Section "MKV" SEC03
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.mkv\shell\${PRODUCT_NAME}" "Icon" '$INSTDIR\ktuvit-downloader-launcher.exe,0'
  WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.mkv\shell\${PRODUCT_NAME}\command" "" '"$INSTDIR\ktuvit-downloader-launcher.exe" input "%1"'
SectionEnd
Section "AVI" SEC04
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
    WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.avi\shell\${PRODUCT_NAME}" "Icon" '$INSTDIR\ktuvit-downloader-launcher.exe,0'
    WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.avi\shell\${PRODUCT_NAME}\command" "" '"$INSTDIR\ktuvit-downloader-launcher.exe" input "%1"'
SectionEnd
Section "MP4" SEC05
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
    WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.mp4\shell\${PRODUCT_NAME}" "Icon" '$INSTDIR\ktuvit-downloader-launcher.exe,0'
    WriteRegStr HKLM "SOFTWARE\Classes\SystemFileAssociations\.mkv\shell\${PRODUCT_NAME}\command" "" '"$INSTDIR\ktuvit-downloader-launcher.exe" input "%1"'
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\${PRODUCT_NAME}.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\${PRODUCT_NAME}.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC00} "Main $(^Name) app"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC01} "Notification icons for $(^Name)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC02} "Associate folders to $(^Name)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC03} "Associate .mkv files to $(^Name)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC04} "Associate .avi files to $(^Name)"
  !insertmacro MUI_DESCRIPTION_TEXT ${SEC05} "Associate .mp4 files to $(^Name)"
!insertmacro MUI_FUNCTION_DESCRIPTION_END

Function .onInit
  SectionSetFlags ${SEC00} 17
  SectionSetFlags ${SEC01} 17
FunctionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
  Delete "$INSTDIR\${PRODUCT_NAME}_Uninst.exe"
  Delete "$INSTDIR\ktuvit-downloader.exe"
  Delete "$INSTDIR\ktuvit-downloader-launcher.exe"
  Delete "$INSTDIR\snoretoast-x64.exe"
  RMDir /r "$INSTDIR\notif-icons"
  RMDir "$INSTDIR"
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKLM "SOFTWARE\Classes\Folder\shell\${PRODUCT_NAME}"
  DeleteRegKey HKLM "SOFTWARE\Classes\SystemFileAssociations\.mkv\shell\${PRODUCT_NAME}"
  DeleteRegKey HKLM "SOFTWARE\Classes\SystemFileAssociations\.avi\shell\${PRODUCT_NAME}"
  DeleteRegKey HKLM "SOFTWARE\Classes\SystemFileAssociations\.mp4\shell\${PRODUCT_NAME}"
  SetAutoClose true
SectionEnd