# Platform Expansion Plan

QBZ Downloader is ready to move beyond the Windows-only release channel with a small amount of packaging discipline. The runtime stack is already mostly cross-platform:

- Electron provides native shells for Windows, macOS, and Linux.
- `better-sqlite3` is cross-platform when rebuilt on the target OS/architecture.
- FFmpeg and fpcalc can be resolved from the bundled `bin` directory or from the user's `PATH`.
- Application state uses Electron's `app.getPath('userData')` in packaged builds, so installed apps write data to the OS-appropriate profile directory.

## Build Targets

The package now exposes explicit build commands:

- `npm run desktop:dist:win` builds the Windows NSIS installer.
- `npm run desktop:dist:portable` builds the Windows portable package.
- `npm run desktop:dist:mac` builds macOS DMG and ZIP artifacts.
- `npm run desktop:dist:linux` builds Linux AppImage, DEB, and tar.gz artifacts.
- `npm run desktop:dist:all` declares all targets, but macOS artifacts should be produced on macOS for signing/notarization reliability.

## Native Dependencies

`better-sqlite3` should be rebuilt on each platform before packaging. The existing `desktop:rebuild` step already runs the Electron native rebuild flow, so release jobs should run packaging on native OS runners instead of relying on cross-compilation for every artifact.

Recommended CI matrix:

- Windows x64: `npm run desktop:dist:win` and `npm run desktop:dist:portable`
- macOS x64/arm64: `npm run desktop:dist:mac`
- Linux x64: `npm run desktop:dist:linux`

## Bundled Binaries

The binary resolver now checks these locations before falling back to `PATH`:

- `bin/<platform>-<arch>/<binary>`
- `bin/<platform>/<binary>`
- `bin/<binary>`

That allows releases to ship platform-specific FFmpeg/fpcalc binaries such as:

```text
bin/win32-x64/ffmpeg.exe
bin/darwin-arm64/ffmpeg
bin/linux-x64/ffmpeg
```

For developer builds, installing FFmpeg in `PATH` remains sufficient.

## Remaining Release Work

- Add a proper `.icns` icon for macOS if the PNG fallback is not accepted by the final signing pipeline.
- Configure Apple Developer signing and notarization secrets before distributing macOS builds publicly.
- Add Linux package metadata such as maintainer and desktop categories once a release owner is chosen.
- Smoke-test download path selection, open-folder actions, notifications, and auto-update behavior on each OS before publishing stable artifacts.
