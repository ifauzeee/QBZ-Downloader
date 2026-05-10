# Changelog

All notable changes to this project will be documented in this file.

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

## [5.1.2] - 2026-05-10
### Added
- Implemented **Pure AMOLED Black** theme (`#000000`) for high-contrast desktop experience.
- Expanded Onboarding/Setup view to 720px for a more immersive desktop-first initialization.

### Fixed
- **Critical Fix: Invalid Request Signature**: Resolved the "Invalid Request Signature" error by strictly aligning the hashing algorithm with case-sensitive endpoint requirements and proper parameter sorting.
- **Desktop Session Stability**: Fixed the "Access Restricted" (Dashboard Lock) regression by bypassing local password checks in Desktop mode.
- **Data Persistence**: Guaranteed that setup data and credentials persist across restarts by forcing absolute database pathing.
- **Shutdown Integrity**: Added database `WAL Checkpoints` during shutdown to ensure all settings are safely flushed to disk.
- Fixed persistent "Token Invalid" notification loop when background services run with old credentials.
- Optimized `electron/main.cjs` to stop aggressive legacy data migration.

### Changed
- Secured startup sequence: background services (Queue & Watcher) are now suspended until valid credentials are configured.
- Refined UI aesthetics: removed decorative gradients for a clean, professional AMOLED look.

## [5.1.2] - 2026-05-10

### 🐞 Bug Fixes
- **Critical Fix: Invalid Request Signature**: Refactored the Qobuz API signing logic to use dynamic parameter sorting, resolving "Invalid Request Signature" errors for certain accounts and custom credentials.
- **Improved Verification**: The setup wizard now performs a real signature test during the verification step to ensure the App Secret is valid before allowing access to the dashboard.
- **Metadata Resilience**: Fixed minor edge cases in background metadata hydration for tracks with special characters.

## [5.1.1] - 2026-05-10

### ✨ New Features
- **Modern Onboarding Experience**: Completely refactored the desktop setup process into a premium, multi-step wizard with smooth animations and real-time account verification.
- **Native Explorer Integration**: Added "Open Folder" and "Show in Folder" buttons in History and Queue views, allowing users to instantly find downloaded files in Windows Explorer.

### 🛠️ Improvements
- **Enhanced Metadata Resolution**: Improved the background metadata hydration service to handle missing titles and batch downloads more reliably.
- **Visual Polish**: Refined the onboarding UI with glassmorphism effects, dynamic progress hubs, and accent-colored micro-animations.

### 🐞 Bug Fixes
- Fixed a critical issue where batch downloads (albums/playlists) would show as "Loading..." even after completion.
- Resolved multiple TypeScript errors related to `IconProps`, `QueueItem` interfaces, and API response null-safety.
- Corrected a bug where the default download path was not consistently respected in some scenarios.
- Fixed broken IPC handlers for folder selection and file system interaction.

## [5.1.0] - 2026-05-09

### ✨ New Features
- **Missing Tracks Logging**: Automatically creates a `missing_tracks.txt` file in the album folder when tracks are unavailable or fail to download, providing a clear record of missing content.

## [5.0.0] - 2026-05-09

### 🚀 Major New Features
- **Spotify Migration Service**: Effortlessly migrate your music library from Spotify. Import playlists, search for matches in the Qobuz catalog, and batch download with a single click.
- **Library Healer & AI Metadata Repair**: A self-healing system that monitors your library. It automatically relocates missing files, triggers AI-driven metadata repair for incomplete records, and generates health reports.
- **Advanced Analytics Dashboard**: Gain deep insights into your music collection. Features monthly trends, download statistics, period comparisons, and personalized music recommendations based on your habits.
- **Integrated Media Server**: Turn your local machine into a music hub. Stream your high-res library to other devices on your network with built-in playback support.
- **Enhanced Lyrics Pipeline**: Support for both embedded and external (`.lrc`) lyrics. Improved acquisition from multiple sources with robust synchronization compatibility.
- **Premium UI/UX Experience**: A complete visual overhaul featuring:
  - Vibrant, modern design with glassmorphism effects.
  - Full Light and Dark mode support with tailored color palettes.
  - Interactive Audio Visualizers.
  - Real-time download progress indicators and FFmpeg status monitoring.
- **Smart Concurrency & Bandwidth Management**: New global concurrency controller allows you to limit bandwidth and prioritize tasks, ensuring smooth performance even during massive batch imports.

### 🛠️ Improvements
- **FFmpeg Automation**: Automated validation and setup of FFmpeg binaries.
- **Robust Metadata Engine**: Better handling of contributor tags, cover art detection, and multi-disc albums.
- **Security Hardening**: Implemented strict Content Security Policies (CSP) and lowered API rate limits for production-ready stability.
- **Performance Optimization**: Refactored core services to reduce memory footprint and improve database query speed.
- **Full Internationalization**: Complete translation support for all core features.

### 🐞 Bug Fixes
- Resolved 404 errors in Dashboard Analytics and Recommendation routes.
- Fixed circular dependency issues in service initialization.
- Addressed TypeScript compilation errors in `LibraryStatisticsService` and `PlaylistWatcherService`.
- Fixed missing lyrics download and album zip creation logic.
- Corrected language dropdown visibility in Light mode.
- Improved playback robustness for Qobuz streams and quality normalization.

---

## [Pre-v5.0.0]
*Initial development and stabilization phases leading to the major v5 release.*
