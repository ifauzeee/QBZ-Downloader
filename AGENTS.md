# QBZ-Downloader — Agent Guide

## Repo structure
- **`src/`** — ESM Node.js/TypeScript backend (NodeNext modules). Entry: `src/index.ts`
- **`client/`** — React 18 + Vite + Tailwind frontend (built to `src/services/dashboard/public/`)
- **`electron/`** — Electron shell (`main.cjs` starts backend via dynamic import, loads dashboard)
- **`scripts/`** — build helpers (sync-version, rebuild-electron-native, bundle-binaries)
- **`bin/`** — platform binaries (ffmpeg, fpcalc), populated at build time by `scripts/bundle-binaries.cjs`

## Version sync
Version must match in **3 files**: `package.json`, `client/package.json`, `client/public/manifest.json`.
After bumping `package.json` version, run:
```
npm run sync-version
```
This also updates the README badge and CHANGELOG top entry. **Do not bump versions manually.**

## Build order (for releases)
```
npm run build:full   # sync-version → client npm ci + build → tsc + copy-assets
```
Then `scripts/rebuild-electron-native.cjs` rebuilds `better-sqlite3` for Electron's Node ABI.
Then `scripts/bundle-binaries.cjs` copies ffmpeg (from ffmpeg-static) + fpcalc (from GitHub) into `bin/<platform>-<arch>/`.

## Tests
```
npm test   # = npm run test:native (rebuild better-sqlite3) + npx vitest run
```
The native rebuild step is required — vitest will fail without it. Tests live in `src/**/*.test.ts` (vitest, node env).

Frontend tests (vitest, jsdom):
```
cd client && npm test
```

CI test workflow (`test.yml`): lint → `npx tsc --noEmit` → test (backend), then lint → build → test (frontend).
Husky pre-commit and pre-push both run `npm test`.

## Config system
Settings are stored in SQLite, read via `CONFIG` proxy object (`src/config.ts`). **Not from .env files.**
- `CONFIG` caches values and clears on `EVENTS.SETTINGS.UPDATED`
- Qobuz credentials (appId, appSecret, token, userId) are in DB, not env vars
- Desktop mode env vars (`DASHBOARD_PORT`, `DASHBOARD_HOST`) are used when `QBZ_DESKTOP=1`

## Conventions
- **ESLint**: single quotes, semicolons required, 4-space indent (enforced by Prettier)
- **Prettier**: 4-space tabs, no trailing commas, 100 print width
- `npm run lint` only covers `src/**/*.ts`; `cd client && npm run lint` for frontend
- TypeScript: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` off

## Release workflow
Push a tag matching `v*` triggers `desktop-release.yml` (3 parallel jobs: Windows, macOS, Linux).
Each job: build:full → verify version → test → lint → smoke → rebuild native → bundle binaries → publish.

**Known gotcha:** Tag push auto-creates a GitHub release (published, not draft). electron-builder's `--publish always` can fail on a pre-existing release, uploading only the first platform's assets. Fix:
```
gh release delete vX.Y.Z --yes
# then re-run the CI workflow for that tag
```

After re-run, update release body with CHANGELOG content:
```
gh release edit vX.Y.Z --notes-file CHANGELOG.md
```

## Key bug history (for context when editing related code)
- **Format 1 preview bypass** (`src/api/qobuz.ts:423-440`): format_id=1 was being overwritten by quality detection (bit_depth/mime_type), bypassing sample rejection in `download.ts`. Fixed with early return when `rawFormatId === 1`.
- **FLAC tagging corruption** (`src/services/metadata.ts:756-816`): `flac-metadata` v0.1.1 `processor.push()` inside event handler corrupts audio frames. Replaced with ffmpeg `-c copy` stream-copy mode.
- **Cover embed bug** (`src/services/download.ts:441`): `coverBuffer` unconditionally passed to `writeMetadata`. Must be gated on `CONFIG.metadata.embedCover`.

## Dependencies with quirks
- `better-sqlite3` must be rebuilt for each Electron version (handled by `scripts/rebuild-electron-native.cjs` with multi-path fallback to find `@electron/rebuild`)
- `ffmpeg-static` provides ffmpeg path at runtime; `scripts/bundle-binaries.cjs` copies it for distribution
- `electron-updater` is optional (graceful fallback in `electron/main.cjs`)
