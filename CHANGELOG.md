# Changelog

All notable changes to this project will be documented in this file.

## [5.2.0] - 2026-05-15

### 🚀 Technical Foundation (Roadmap Phase 1)

- **Secure Encryption** — Migrated credential encryption to **Electron `safeStorage`** API. Keys are now tied to the OS keychain, ensuring they are not lost if the application folder is moved. Added fallback for non-Electron environments.
- **Improved Caching** — Replaced basic FIFO cache with a **proper LRU (Least Recently Used) cache** using `lru-cache`. This ensures track metadata and search results are managed efficiently.
- **Single Source of Truth (Versioning)** — Fixed versioning inconsistency. `APP_VERSION` is now dynamically read from `package.json`, and README badges have been synchronized.
- **Enhanced API Security** — Implemented more restrictive **rate limiting** on the Express dashboard API to prevent flooding and improve local stability.
- **AI Prompt Hardening** — Added input sanitization to `AIMetadataService` to prevent prompt injection when repairing metadata via LLMs (Gemini/OpenAI).
- **Service Refactoring** — Exported multiple service classes (`NotificationService`, `ThemeService`, `MigrationService`) to enable isolated unit testing and dependency injection.

### 🧪 Test Coverage Expansion (Roadmap Phase 2)

- **Massive Test Suite Growth** — Implemented comprehensive unit tests for **15+ core services**, increasing `src/services` coverage to **64%+**.
- **Validated Services** — Added test suites for:
    - `DownloadEngine` (Resumes, Cancellations, Integrity hashing)
    - `MetadataService` (Qobuz mapping, Genre translation, Tag building)
    - `BatchImportService` (CSV/M3U8 imports, ZIP archival)
    - `QualityScannerService` (FFmpeg-based lossless verification)
    - `PlaylistWatcherService` (Recursive scan logic, duplicates prevention)
    - `LibraryHealerService`, `AIMetadataService`, `LibraryStatisticsService`, `FormatConverterService`, `MediaServerService`, `RecommendationService`, `NotificationService`, and `ThemeService`.
- **Infrastructure Stability** — Resolved critical race conditions and timing issues in asynchronous tests using `vi.waitFor` and robust stream mocks.
- **Full Type Safety** — Audited and fixed all TypeScript errors in the test suite, achieving zero `tsc` errors across the project.
- **Frontend Component Testing** — Initialized `@testing-library/react` for the dashboard UI, adding test suites for critical components like `Player` and `QueuePanel`.
- **E2E Integration Flow** — Added full end-to-end simulation covering the entire lifecycle: Search → Queue → Download → Metadata writing → Library Scan.

### 🛠️ DevOps & Security

- **Cross-Platform CI Matrix** — Upgraded `.github/workflows/test.yml` to automatically run tests across `ubuntu-latest`, `windows-latest`, and `macos-latest` on both Node.js 20.x and 22.x.
- **Electron & Security Upgrade** — Bumped `electron` to `^33.0.0` (from 32.0.0) to include critical security patches. Audited and updated all vulnerable NPM dependencies to ensure a secure build environment.

---

## [5.1.6] - 2026-05-13


### 🐞 Bug Fixes

- **Queue Store Crash** — Fixed a `Cannot read properties of undefined (reading 'map')` crash in `queueStore.ts` by ensuring the queue state is always initialized as an array and adding defensive guards in `updateItemProgress`.
- **Premature API Fetching** — Added a connection guard in `QueueView.tsx` to prevent `fetchQueue` from being called before the socket connection (and dashboard authentication) is fully established, preventing 400/401 errors during startup.

---

## [5.1.5] - 2026-05-10

### 🐞 Bug Fixes

- **File Stream EPERM Lock** — Fixed a critical issue in `DownloadEngine` where an aborted or timed-out download would fail to destroy the file stream, causing the `QueueProcessor`'s automatic retry mechanism to crash with an `EPERM` error because the previous failed connection still held a lock on the `.flac` file.

---