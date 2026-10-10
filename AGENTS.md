# QBZ-Downloader — Agent Guide

## Repo structure

- **`src/`** — ESM Node.js/TypeScript backend (NodeNext modules). Entry: `src/index.ts`
- **`client/`** — React 18 + Vite + Tailwind frontend (built to `src/services/dashboard/public/`)
- **`electron/`** — Electron shell (`main.cjs` starts backend via dynamic import, loads dashboard)
- **`scripts/`** — build helpers (sync-version, rebuild-electron-native, bundle-binaries)
- **`bin/`** — platform binaries (ffmpeg, fpcalc), populated on demand by `scripts/bundle-binaries.cjs` when packaging locally

## Version sync

Version must match in **5 files**: `package.json`, `package-lock.json`, `client/package.json`, `client/package-lock.json`, `client/public/manifest.json`.
After bumping `package.json` version, run:

```
npm run sync-version
```

This also updates the README badge and CHANGELOG top entry. **Do not bump versions manually.**

## Build order

```
npm run build:full   # sync-version → client npm ci + build → tsc + copy-assets
```

Then `scripts/rebuild-electron-native.cjs` rebuilds `better-sqlite3` for Electron's Node ABI
(`npm run desktop:start` does this for you).

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

## Distribution

There are **no binary releases**. No installer, portable build, or container image is
published: `desktop-release.yml` and `docker-publish.yml` were removed and
`package.json` carries no electron-builder/publish configuration. The app is
distributed as source only; users build it with the commands above.

`desktop:rebuild` and `desktop:start` are kept: they run the app from source and
are the way to launch it, not distribution. The `desktop:dist*` packaging scripts
are what were removed.

Consequences:

- Pushing a `v*` tag no longer creates a GitHub release or publishes anything.
- The desktop app has no auto-update — the update UI, IPC bridge and
  `electron-updater` dependency were removed along with the release channel.
- `unraid/qbz-downloader.xml` is reference only; the GHCR image it pointed to is
  no longer built.

## CI and branch protection

`main` is protected by two repository rulesets, **not** classic branch protection — a 404 from `gh api repos/:owner/:repo/branches/main/protection` is expected, not a regression.

- **`main protection (checks)`** (id 24133933) — `non_fast_forward` plus `required_status_checks` for the five `test (*)` jobs in `test.yml` (strict, integration 15368).
- **`main protection (review)`** (id 24133961) — `pull_request`: 1 approving review, dismiss stale reviews on push, resolve threads. Bypass actors: the Dependabot app (id 29110, `pull_request` mode) and the repo owner.

The review rule is its own ruleset so Dependabot can skip the human approval without also skipping the required status checks. Rulesets and classic protection are aggregated, so a bypass actor does **not** get around a classic rule — that is why the classic rule was deleted instead of supplemented.

GitHub refuses to let `GITHUB_TOKEN` approve a pull request, so `.github/workflows/dependabot-automerge.yml` only queues auto-merge; it cannot self-approve. Effective rules:

```
gh api repos/:owner/:repo/rules/branches/main
```

When editing a ruleset over REST, the review rule type is `pull_request` (not `required_pull_request`), and there is no standalone conversation-resolution rule — it is the `required_review_thread_resolution` parameter inside `pull_request`. Wrong names return HTTP 422 `data matches no possible input`.

## Key bug history (for context when editing related code)

- **Format 1 preview bypass** (`src/api/qobuz.ts:423-440`): format_id=1 was being overwritten by quality detection (bit_depth/mime_type), bypassing sample rejection in `download.ts`. Fixed with early return when `rawFormatId === 1`.
- **FLAC tagging corruption** (`src/services/metadata.ts:756-816`): `flac-metadata` v0.1.1 `processor.push()` inside event handler corrupts audio frames. Replaced with ffmpeg `-c copy` stream-copy mode.
- **Cover embed bug** (`src/services/download.ts:441`): `coverBuffer` unconditionally passed to `writeMetadata`. Must be gated on `CONFIG.metadata.embedCover`.

## Dependencies with quirks

- `better-sqlite3` must be rebuilt for each Electron version (handled by `scripts/rebuild-electron-native.cjs` with multi-path fallback to find `@electron/rebuild`)
- `ffmpeg-static` provides ffmpeg path at runtime; `scripts/bundle-binaries.cjs` copies it into `bin/` only when someone packages the app locally
- `electron-builder` is still a devDependency, but nothing configures or invokes it anymore
