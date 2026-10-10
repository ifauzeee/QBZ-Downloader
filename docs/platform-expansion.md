# Platform Expansion Plan

QBZ Downloader is ready to move beyond the Windows-only release channel with a small amount of packaging discipline. The runtime stack is already mostly cross-platform:

- Electron provides native shells for Windows, macOS, and Linux.
- `better-sqlite3` is cross-platform when rebuilt on the target OS/architecture.
- FFmpeg and fpcalc can be resolved from the bundled `bin` directory or from the user's `PATH`.
- Application state uses Electron's `app.getPath('userData')` in packaged builds, so installed apps write data to the OS-appropriate profile directory.

## Build Targets

The project no longer ships prebuilt packages, so there are no `desktop:dist:*`
commands. To run the app on any platform:

```bash
npm run build:full   # dashboard + backend
npm run desktop:start
```

## Native Dependencies

CI no longer builds artifacts, so there is no packaging matrix. The only cross-platform
requirement is building `better-sqlite3` on the platform it runs on, which
`npm run desktop:start` handles through `scripts/rebuild-electron-native.cjs`.

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

## Remaining Work

- Optional: a proper `.icns` icon for macOS if someone packages the app themselves.
- Optional: Apple Developer signing and notarization secrets for whoever builds a
  distributable bundle locally.
- Smoke-test download path selection, open-folder actions, notifications, and
  library scanning on each OS after a local build.

## Implementation Status (v5.3.0)

- [x] CI workflow: macOS job (macos-latest, DMG + ZIP)
- [x] CI workflow: Linux job (ubuntu-latest, AppImage + deb + tar.gz)
- [x] Native rebuild per platform (better-sqlite3 via @electron/rebuild)
- [x] bin/ directory structure for platform binaries
- [ ] FFmpeg/fpcalc binaries populated (requires manual download per platform)
- [ ] macOS code signing & notarization (requires Apple Developer account)
- [x] README updated for 3 platforms
- [x] Version badge shows 3 platform download links
