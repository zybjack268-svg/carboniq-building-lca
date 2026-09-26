Unicode true
!ifndef SOURCE_DIR
  !error "Pass /DSOURCE_DIR=<path to win-unpacked>"
!endif
!ifndef OUTPUT_FILE
  !error "Pass /DOUTPUT_FILE=<path to installer exe>"
!endif

Name "CarbonIQ"
OutFile "${OUTPUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\CarbonIQ"
RequestExecutionLevel user
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "CarbonIQ" SEC_MAIN
  SetOutPath "$INSTDIR"
  File /r "${SOURCE_DIR}\*"
  CreateDirectory "$SMPROGRAMS\CarbonIQ"
  CreateShortCut "$SMPROGRAMS\CarbonIQ\CarbonIQ.lnk" "$INSTDIR\CarbonIQ.exe"
  CreateShortCut "$DESKTOP\CarbonIQ.lnk" "$INSTDIR\CarbonIQ.exe"
  CreateShortCut "$SMPROGRAMS\CarbonIQ\卸载 CarbonIQ.lnk" "$INSTDIR\Uninstall CarbonIQ.exe"
  WriteUninstaller "$INSTDIR\Uninstall CarbonIQ.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ" "DisplayName" "CarbonIQ"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ" "DisplayVersion" "0.2.2"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ" "Publisher" "CarbonIQ"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ" "UninstallString" '"$INSTDIR\Uninstall CarbonIQ.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ" "DisplayIcon" "$INSTDIR\CarbonIQ.exe"
SectionEnd

Section "Uninstall"
  Delete "$SMPROGRAMS\CarbonIQ\CarbonIQ.lnk"
  Delete "$DESKTOP\CarbonIQ.lnk"
  Delete "$SMPROGRAMS\CarbonIQ\卸载 CarbonIQ.lnk"
  RMDir "$SMPROGRAMS\CarbonIQ"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\CarbonIQ"
  RMDir /r "$INSTDIR"
SectionEnd
