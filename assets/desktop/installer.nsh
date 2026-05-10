; ─────────────────────────────────────────────────────────────────────────────
; QBZ Downloader — Custom NSIS Uninstaller Script
; Cleans up ALL userData locations on uninstall (with user confirmation).
;
; Confirmed Electron userData paths on Windows (package.json name = qbz-downloader):
;   %APPDATA%\qbz-downloader            ← PRIMARY (Roaming, confirmed)
;   %LOCALAPPDATA%\qbz-downloader       ← secondary (Local)
;   %LOCALAPPDATA%\qbz-downloader-updater ← electron-updater cache
;   %APPDATA%\QBZ Downloader            ← legacy productName fallback
;   %LOCALAPPDATA%\QBZ Downloader       ← legacy productName fallback
; ─────────────────────────────────────────────────────────────────────────────

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Do you want to remove all QBZ Downloader data?$\n$\nThis includes your database, download history, credentials, and settings.$\n$\nClick YES for a clean uninstall.$\nClick NO to keep your data for a future reinstall." \
    IDYES wipe_data IDNO skip_wipe

  wipe_data:
    ; PRIMARY — confirmed Electron userData location (Roaming)
    RMDir /r "$APPDATA\qbz-downloader"
    ; Secondary — Local AppData variant
    RMDir /r "$LOCALAPPDATA\qbz-downloader"
    ; electron-updater cache
    RMDir /r "$LOCALAPPDATA\qbz-downloader-updater"
    ; Legacy productName-based paths
    RMDir /r "$APPDATA\QBZ Downloader"
    RMDir /r "$LOCALAPPDATA\QBZ Downloader"
    ; Migration marker
    Delete "$INSTDIR\.desktop-migrated"
    Goto done_wipe

  skip_wipe:
    ; User chose to keep data — nothing to do

  done_wipe:
!macroend
