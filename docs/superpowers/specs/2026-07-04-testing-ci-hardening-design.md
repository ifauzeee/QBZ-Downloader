# Phase 3: Testing & CI Hardening

## Goal
Increase component test coverage to >=75%, add Electron smoke test, and optimize CI caching for QBZ-Downloader.

## Background
- 22 components in `client/src/components/`, only 5 have tests (22.7%)
- 6 large components identified as priority: LibraryView, SearchView, AnalyticsView, QueueView, ArtistDetailView, AlbumDetailView
- No coverage thresholds configured
- No Electron/desktop smoke tests exist
- `npm run test:native` (rebuild better-sqlite3) runs on every CI job with no caching

## Scope

### 1. Component Tests (6 priority components)
- **Pattern**: Mirror existing tests (BatchImportView.test.tsx, SettingsView.test.tsx)
  - Mock all context providers (ToastContext, LanguageContext, PlayerContext, SettingsContext, ThemeContext, NavigationContext)
  - Mock `smartFetch` API via `../../utils/api`
  - Use `vi.hoisted()` + `vi.mock()` pattern
  - `@testing-library/react` render + assert
- **Coverage per test**: loading state, error state, empty state, data rendering
- **Files to create**: 6 test files in `client/src/components/__tests__/`
  - `LibraryView.test.tsx`
  - `SearchView.test.tsx`
  - `AnalyticsView.test.tsx`
  - `QueueView.test.tsx`
  - `ArtistDetailView.test.tsx`
  - `AlbumDetailView.test.tsx`

### 2. Coverage Threshold (75%)
- Add `@vitest/coverage-v8` to client devDependencies
- Configure coverage in `client/vitest.config.ts`:
  - provider: v8
  - enabled: true
  - include: `['src/components/**/*.tsx']`
  - thresholds: 75% (statements, branches, functions, lines)

### 3. CI Caching (better-sqlite3)
- Add `actions/cache@v4` step in `test.yml` and `desktop-release.yml`
- Cache path: `node_modules/better-sqlite3/build/`
- Key: `better-sqlite3-${{ runner.os }}-${{ hashFiles('package-lock.json') }}`

### 4. Electron Smoke Test
- Add `playwright` devDependency to root
- Create `tests/electron-smoke.test.ts` (root level)
- Uses `playwright._electron.launch()` to start the app
- Checks: window title contains "QBZ Downloader", `/api/status` responds
- **CI**: Only runs on push to main, Windows only
- Add `test:smoke` script to root package.json

## Files Modified
- `client/vitest.config.ts` — add coverage config
- `.github/workflows/test.yml` — add caching, conditionally skip smoke test
- `.github/workflows/desktop-release.yml` — add caching
- `client/package.json` — add `@vitest/coverage-v8`
- `package.json` (root) — add `playwright`, add `test:smoke` script

## Files Created
- `client/src/components/__tests__/LibraryView.test.tsx`
- `client/src/components/__tests__/SearchView.test.tsx`
- `client/src/components/__tests__/AnalyticsView.test.tsx`
- `client/src/components/__tests__/QueueView.test.tsx`
- `client/src/components/__tests__/ArtistDetailView.test.tsx`
- `client/src/components/__tests__/AlbumDetailView.test.tsx`
- `tests/electron-smoke.test.ts`

## Out of Scope
- Tests for remaining 11 small components (Icons, DropZone, ErrorBoundary, CommandPalette, etc.) — deferred
- `verbatimModuleSyntax` tsconfig change — deferred to separate PR
- Integration/E2E tests beyond Electron smoke test
- Non-Windows Electron testing

## Risks
- Electron smoke test may be flaky in CI (timeouts, GPU issues) — can be disabled if problematic
- Coverage at 75% may fail if any of the 6 new tests are too shallow — mitigate by ensuring comprehensive assertions
- `playwright._electron` API is deprecated but functional — monitor for removal
