# Changelog

All notable changes to this project will be documented in this file.

## [5.2.0] - 2026-05-17

This release summarizes the changes from `v5.1.6` to `v5.2.0`.

### Security

- **Credential encryption** - Migrated local credential encryption to Electron `safeStorage`, with a non-Electron fallback for CLI and test environments.
- **Dashboard authentication** - Hashes dashboard passwords with SHA-256 before storing them in `sessionStorage`, accepts hashed auth on the backend, and avoids double-hashing during socket/fetch authentication.
- **Content Security Policy hardening** - Removed `unsafe-eval` from the dashboard CSP and restricted `connect-src` to localhost and Qobuz endpoints.
- **Batch import hardening** - Replaced ad hoc CSV parsing with `csv-parse` and enforced URL import limits for safer playlist/batch ingestion.
- **AI metadata prompt hardening** - Sanitized metadata repair input before sending prompts to configured LLM providers.
- **Token privacy** - Removed token suffix fragments from `token:updated` events so credential material is not exposed to listeners.

### Desktop And Release

- **Electron 40 upgrade** - Updated Electron to the `^40.10.0` release line and kept package metadata aligned with the changelog.
- **Native module rebuilds** - Added `desktop:rebuild` and made `desktop:start` rebuild `better-sqlite3` for the active Electron ABI before launch.
- **Startup health check** - Added `/api/status` so the Electron shell waits for the local dashboard server before loading the UI.
- **Packaged dashboard startup** - Desktop mode now forces the runtime dashboard host/port from Electron so upgraded installs with old database settings still load `127.0.0.1:3210`, and release builds rebuild native modules before packaging.
- **Desktop setup endpoints** - Restored `/api/onboarding`, `/api/settings`, and `/api/credentials/status` so the packaged dashboard no longer logs setup/status 404s during launch.
- **Version synchronization** - Added `scripts/sync-version.js`, runs it automatically during `build:full`, and keeps root package, client package, manifest, README, and changelog versions aligned.
- **Release CI guard** - Added a desktop release workflow step that fails if root, client, and manifest versions diverge after the full build.
- **Deterministic release builds** - `build:full` now uses `npm ci` for the dashboard client so release builds respect the committed lockfile.
- **Repository cleanup** - Removed generated `repomix-output.xml` from tracking and added it to `.gitignore`.

### Dashboard And Frontend

- **Persistent UI settings** - Moved theme, language, navigation, and related UI state through backend settings instead of keeping them only in local frontend state.
- **Local dashboard binding** - Binds the dashboard to `127.0.0.1` by default and warns when password protection is disabled.
- **Hi-Res upgrade picker** - Library scans now show multiple Hi-Res candidate versions with album art, release details, match score, and variant warnings so users can choose the correct version before queueing an upgrade.
- **Hi-Res candidate validation** - Scanner now ignores unverified/sample Hi-Res URLs, probes early stream readability, and download errors identify unavailable Qobuz streams instead of surfacing only `aborted`.
- **Frontend performance** - Replaced Framer Motion-heavy interactions with `dnd-kit` and CSS animation paths in key dashboard views.
- **Queue panel stability** - Hardened queue rendering, drag/drop behavior, and progress updates with stronger state guards.
- **Internationalization cleanup** - Corrected leaked Indonesian strings in Chinese locale data and fixed the Hindi `desc_config` translation.
- **Audio preview caching** - Replaced preview `Map` caches with LRU-backed caches to bound memory use.
- **Batch ZIP cleanup** - When batch ZIP creation succeeds, generated source files and now-empty download folders are removed so ZIP-only exports do not leave duplicate artist/album folders behind.

### Backend Reliability

- **Queue processor race fixes** - Replaced the re-entrant processing guard with running task tracking, separated fail/requeue responsibilities, removed recursive `processNext()` scheduling from task finalizers, and guarded delayed retry requeues against stale queue items.
- **Queue startup recovery** - Queue additions now require complete Qobuz credentials and wake the queue processor when credentials become valid, preventing new downloads from staying `pending` forever after first-run setup.
- **Library healer safety** - Added bounded recursive lookup and `lstat()`-based symlink avoidance to prevent runaway scans.
- **Safer library upgrades** - Stored upgrade candidate metadata in the library database, flagged remix/variant candidates instead of auto-selecting them silently, and protected same-path upgrades with temporary replacement files.
- **Unavailable stream handling** - Treats early-closed Qobuz Hi-Res streams as unavailable candidates instead of retrying them as unknown failures.
- **Qobuz API singleton cleanup** - Consolidated Qobuz API usage behind the singleton path and updated dashboard routes/tests around the new access pattern.
- **Database and history stability** - Tightened database initialization, settings/history persistence, and test isolation around `better-sqlite3`.
- **Friendly errors** - Added bilingual Indonesian/English friendly error support and localized remaining backend help hints.
- **Logging cleanup** - Moved metadata template replacement logs to the `META` debug channel to reduce noisy normal output.

### Testing And CI

- **Service test expansion** - Added or expanded tests for `DownloadEngine`, `MetadataService`, `BatchImportService`, `QualityScannerService`, `PlaylistWatcherService`, `LibraryHealerService`, `AIMetadataService`, `LibraryStatisticsService`, `FormatConverterService`, `MediaServerService`, `RecommendationService`, `NotificationService`, `ThemeService`, `SettingsService`, `HistoryService`, `DatabaseService`, and `LibraryScannerService`.
- **Frontend component tests** - Added React Testing Library coverage for dashboard components including `Player` and `QueuePanel`.
- **End-to-end flow test** - Added an integration simulation covering search, queueing, download, metadata writing, and library scan flow.
- **TypeScript stabilization** - Resolved strict TypeScript and lint failures across backend services, dashboard routes, and test mocks.
- **Cross-platform CI matrix** - Updated the test workflow to run on Ubuntu, Windows, and macOS across Node.js 20.x and 22.x.
- **Frontend CI coverage** - The test workflow now installs, builds, and tests the dashboard client, and desktop release publishing runs both backend and frontend tests before packaging.

### Dependency Changes

- **Runtime dependencies** - Added `lru-cache` and `csv-parse`.
- **Desktop dependencies** - Added `@electron/rebuild` for native module rebuild support.
- **Frontend test dependencies** - Added React Testing Library and related test setup for component coverage.
- **Frontend runtime alignment** - Settled the desktop dashboard stack on React 18.3.1, Vite 6.x, and Electron 40.x for the release build.

---

## [5.1.6] - 2026-05-13


### Bug Fixes

- **Queue Store Crash** - Fixed a `Cannot read properties of undefined (reading 'map')` crash in `queueStore.ts` by ensuring the queue state is always initialized as an array and adding defensive guards in `updateItemProgress`.
- **Premature API Fetching** - Added a connection guard in `QueueView.tsx` to prevent `fetchQueue` from being called before the socket connection (and dashboard authentication) is fully established, preventing 400/401 errors during startup.

---

## [5.1.5] - 2026-05-10

### Bug Fixes

- **File Stream EPERM Lock** - Fixed a critical issue in `DownloadEngine` where an aborted or timed-out download would fail to destroy the file stream, causing the `QueueProcessor`'s automatic retry mechanism to crash with an `EPERM` error because the previous failed connection still held a lock on the `.flac` file.

---
