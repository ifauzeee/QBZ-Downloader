# Contributing

## Local Setup

```bash
git clone https://github.com/ifauzeee/QBZ-Downloader.git
cd QBZ-Downloader
npm ci
cd client && npm ci && cd ..
```

## Available Commands

| Command | Description |
| ------- | ----------- |
| `npm run build` | Compile TypeScript |
| `npm run build:full` | Sync version, build client, then compile root |
| `npm test` | Run all backend tests |
| `npm run lint` | Lint backend source |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format with Prettier |
| `npx tsc --noEmit` | Type-check without emitting |
| `cd client && npm test` | Run frontend tests |
| `cd client && npm run build` | Build frontend bundle |
| `npm run sync-version` | Sync version across all package files |

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `perf`, `test`, `security`, `style`.

Examples:
- `feat(qobuz): support multiple accounts`
- `fix(dashboard): handle port conflict on startup`
- `security(credential): migrate to safeStorage encryption`
- `chore(release): 5.2.3`

## Branch Naming

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `chore/<description>` — tooling, CI, maintenance
- `security/<description>` — security patches

## Before Submitting

1. Run `npm run lint` and fix any errors
2. Run `npx tsc --noEmit` and fix type errors
3. Run `npm test` and ensure all tests pass
4. Run `cd client && npm test` for frontend tests
5. Ensure `npm audit --audit-level=high` reports 0 vulnerabilities

## Project Structure

```
src/
  api/          — Qobuz, Spotify, lyrics API clients
  services/     — Core services (download, metadata, scan, etc.)
  utils/        — Shared utilities (crypto, logger, events, etc.)
  config.ts     — Application configuration
  plugins/      — Plugin system
client/
  src/          — React dashboard frontend
  public/       — Static assets
```

## Credential Handling

Sensitive values are encrypted via `src/utils/encryption.ts`:
- Electron runtime: uses `safeStorage` (OS-level encryption)
- Non-Electron: file-based AES-256-CBC fallback with a local key
