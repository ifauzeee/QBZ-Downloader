# Platform Binaries

This directory contains platform-specific binaries bundled with the app via
electron-builder's `extraResources`. The binaries are **not committed** to the
repo — they are downloaded at release-build time by `scripts/bundle-binaries.cjs`
(which runs as the `Bundle platform binaries` step in `desktop-release.yml`).

## Directory Structure

```
bin/
├── darwin-x64/       # macOS Intel (ffmpeg, fpcalc)
├── darwin-arm64/     # macOS Apple Silicon (ffmpeg, fpcalc)
├── linux-x64/        # Linux x86_64 (ffmpeg, fpcalc)
└── win32-x64/        # Windows x64 (ffmpeg.exe, fpcalc.exe)
```

Each directory contains a `.gitkeep` so the structure is tracked, but the actual
binaries are gitignored (see `.gitignore`) to avoid bloating the repository.

## Binary Resolution Order

The app resolves binaries via `src/utils/binaries.ts`:

1. `bin/<platform>-<arch>/<binary>` (exact match)
2. `bin/<platform>/<binary>` (platform fallback)
3. `bin/<binary>` (universal fallback)
4. System PATH

## How Binaries Are Bundled

Run locally (requires network access):

```bash
npm run bundle-binaries
```

This:
- Copies the `ffmpeg` binary from the `ffmpeg-static` npm package (downloaded
  per-platform at `npm install` time) into `bin/<platform>-<arch>/`.
- Downloads `fpcalc` (Chromaprint) from the
  [acoustid/chromaprint](https://github.com/acoustid/chromaprint/releases)
  GitHub releases into `bin/<platform>-<arch>/`.

If a download fails, the step warns but does not fail the build — the app falls
back to system PATH for that binary (with a reduced feature set).

## Sources

- **FFmpeg**: provided by [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static)
- **fpcalc** (Chromaprint): https://github.com/acoustid/chromaprint/releases
