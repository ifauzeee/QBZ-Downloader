# Platform Binaries

This directory contains platform-specific binaries bundled with the app via
electron-builder's `extraResources`.

## Directory Structure

```
bin/
├── darwin-x64/       # macOS Intel (ffmpeg, fpcalc)
├── darwin-arm64/     # macOS Apple Silicon (ffmpeg, fpcalc)
├── linux-x64/        # Linux x86_64 (ffmpeg, fpcalc)
└── win32-x64/        # Windows x64 (ffmpeg.exe, fpcalc.exe)
```

## Binary Resolution Order

The app resolves binaries via `src/utils/binaries.ts`:

1. `bin/<platform>-<arch>/<binary>` (exact match)
2. `bin/<platform>/<binary>` (platform fallback)
3. `bin/<binary>` (universal fallback)
4. System PATH

## Adding Binaries

1. Download the correct binary for each platform/arch
2. Place it in the appropriate `bin/<platform>-<arch>/` directory
3. Ensure it is executable (`chmod +x` on Unix)
4. The `extraResources` config in `package.json` includes `bin/**/*`

## Sources

- **FFmpeg**: https://ffmpeg.org/download.html or https://github.com/BtbN/FFmpeg-Builds
- **fpcalc** (Chromaprint): https://github.com/nicfit/chromaprint-fpcalc/releases
