# Changelog

All notable changes to this project will be documented in this file.

## [5.1.4] - 2026-05-10

### 🐞 Bug Fixes

- **Backend Init & Credentials Sync** — Fixed an issue where the background `QueueProcessor` would always suspend at startup, even if credentials were set. The environment validation was running before the Database Service loaded the settings.
- **"Payload Too Large" Metadata Error** — Increased Express JSON and URL-encoded body limits to 10MB in `dashboard/index.ts` to accommodate large base64 cover art payloads during metadata updates.
- **Hi-Res Quality Verification** — `LibraryScannerService` now rigorously validates `format_id` against the requested quality, preventing Qobuz's silent fallback from incorrectly marking standard tracks as Hi-Res.
- **Queue Progress & Notifications** — 
  - Fixed a misleading "Download Complete" notification firing for files that were skipped because they already existed. 
  - Added robust download progress mapping for batch processing.
- **Queue Resume Database Mapping** — Fixed a critical bug where restarting the application would corrupt the queue. The Database Service failed to correctly map the `content_id` database column to the internal `contentId` object property, causing persistent downloads to fail with a "Missing argument: track_id" error.
- **Library Upgrade Overwrite Logic** — Fixed an issue where the `QueueProcessor` would instantly skip Hi-Res upgrade downloads because a file with the same name already existed on disk. Upgrades now accurately bypass the `skipExisting` check and will actively clean up the older low-quality file if the extension changes.
- **Metadata Template Formatting** — Patched a stateful regex `lastIndex` corruption in `MetadataProcessor` which occasionally skipped variable substitutions during filename generation.
- **Download Engine Progress Bar** — Parsed `Content-Length` from HTTP response headers when stream dimensions are unknown, resolving the 0% progress issue for downloads.

### 🛠️ Improvements

- **Upgrade Action UI** — Added instant visual feedback to the Upgrade button in `LibraryView.tsx`. Clicking now disables the button and updates the label to "Queued ✓", preventing duplicate queues.
- **Album Queue Action UI** — Added real-time visual feedback to the download button in `AlbumDetailView.tsx`. Clicking a track download button now instantly transforms the icon to a colored checkmark, helping you track which songs have already been sent to the download queue.

---

## [5.1.3] - 2026-05-10

### 🐞 Bug Fixes

- **Critical Fix: Credentials Persist After Uninstall** — Qobuz account credentials and session data were surviving a full uninstall/reinstall cycle. Root cause: the NSIS uninstaller was targeting the wrong AppData paths (`%AppData%\QBZ Downloader` / `%LocalAppData%\QBZ Downloader`), while Electron actually writes userData to `%AppData%\qbz-downloader` (Roaming, lowercase — derived from `package.json` `name`, not `productName`).
- **Fixed `installer.nsh`** — Uninstaller now correctly removes **all five** possible data locations:
  - `%APPDATA%\qbz-downloader` ← primary (confirmed actual location)
  - `%LOCALAPPDATA%\qbz-downloader` ← secondary variant
  - `%LOCALAPPDATA%\qbz-downloader-updater` ← electron-updater cache
  - `%APPDATA%\QBZ Downloader` ← legacy productName fallback
  - `%LOCALAPPDATA%\QBZ Downloader` ← legacy productName fallback
- **Fixed `migrateLegacyState()`** — Removed aggressive auto-migration candidates (`exeDir`, `~/Project/QBZ-Downloader`, `~/Documents/QBZ-Downloader`) that caused old credentials to be restored on fresh installs. Migration now only runs when `QBZ_MIGRATE_FROM` env var is explicitly set.

### 🛠️ Improvements

- Uninstall dialog now clearly guides the user: **YES** for a completely clean uninstall, **NO** to preserve data for reinstall.

---