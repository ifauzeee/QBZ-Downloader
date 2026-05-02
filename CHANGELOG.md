# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Persistent Cache**: Implemented two-tier caching system (L1 Memory + L2 SQLite) for improved performance.
- **Resumable Downloads**: Added HTTP Range support for robust download resumption.
- **Smart Detection**: Implemented smart duplicate detection and true resume support.
- **Power-User Navigation**: Added global keyboard shortcuts for faster app navigation.
- **Desktop Enhancements**: Added system tray integration and drag-and-drop support.
- **Security**: Implemented encryption for sensitive Qobuz credentials within the SQLite database.
- **Network Control**: Added bandwidth throttling support for active downloads.
- **Wishlist**: Implemented backend support for bookmarking albums and tracks.
- **SQLite Migration**: Migrated history and resume services to SQLite for better data integrity.

### Changed
- **Modular Architecture**: Refactored `DownloadService` into modular components for better maintainability.
- **Test Optimization**: Switched to in-memory databases for tests to avoid filesystem mock conflicts.

### Fixed
- Resolved various lint errors and fixed history service test suites.

## [4.0.5] - 2026-04-01

### Changed
- Version bump to 4.0.5 for maintenance and stability.

## [4.0.4] - 2026-03-31

### Added
- Updated project wording to reflect desktop-first positioning.
- README updated with clearer onboarding instructions.

### Fixed
- **Download Paths**: Fixed dynamic download path behavior where changes weren't reflected immediately.
- **Route Handling**: Improved `/downloads` route handling to reflect path updates without restarting.
- **Issue #4**: Resolved confusion where completed downloads were not visible in newly selected folders.

## [4.0.3] - 2026-03-31

### Added
- Standard maintenance release.

## [4.0.0] - 2026-03-29

### Added
- **CI/CD**: Automated Windows desktop publishing via GitHub Actions.
- **Desktop Focus**: Pivoted project to a desktop-only runtime for Windows.
