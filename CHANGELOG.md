# Changelog

All notable changes to this project will be documented in this file.

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
