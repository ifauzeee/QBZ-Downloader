# QBZ Downloader v5.3.0 — Cross-Platform Release

This release marks **QBZ Downloader officially available for Windows, macOS, and Linux** through a single automated release pipeline. FFmpeg and fpcalc (Chromaprint) are now bundled into the app, so audio conversion and AcoustID fingerprinting work out of the box with no extra setup.

## Highlights

- 🖥️ **Official macOS & Linux builds** — previously Windows-only, now all three platforms at once.
- 🎞️ **Bundled FFmpeg & fpcalc** — format conversion and music fingerprint matching work out of the box.
- ✅ **Per-release smoke test** — the backend server is verified healthy before any package ships, reducing the risk of broken releases.
- 🤝 **Community files** — PR & issue templates, plus a Code of Conduct, to make contributing easier.

## What's New

| Feature | Description |
|---------|-------------|
| macOS builds | DMG + ZIP for Apple Silicon (arm64); Intel (x64) planned later |
| Linux builds | AppImage, `.deb`, and `.tar.gz` (x64) |
| Binary bundling | `scripts/bundle-binaries.cjs` downloads FFmpeg & fpcalc per-platform at build time |
| Smoke test | Server health-check runs before packaging on every platform |
| Contribution templates | PR template, bug report, feature request, Discussions link |
| Code of Conduct | Contributor Covenant 2.1 |
| Linux metadata | `maintainer` field + desktop categories `Audio;AudioVideo;Music` |

## Download

| Platform | Format | Notes |
|----------|--------|-------|
| Windows | `QBZ-Downloader-Setup-5.3.0.exe` | NSIS installer (x64) |
| Windows | `QBZ-Downloader-Portable-5.3.0.exe` | Portable, no install |
| macOS (Apple Silicon) | `QBZ-Downloader-5.3.0-arm64.dmg` / `.zip` | Intel Macs not yet supported — see Known Issues |
| macOS (Intel) | _Not available in this release_ | Planned for a future release |
| Linux | `QBZ-Downloader-5.3.0-x86_64.AppImage` | Run: `chmod +x *.AppImage` |
| Linux | `QBZ-Downloader-5.3.0-amd64.deb` | `sudo dpkg -i *.deb` |
| Linux | `QBZ-Downloader-5.3.0-x86_64.tar.gz` | Portable archive |

All downloads are available on the [Releases](https://github.com/ifauzeee/QBZ-Downloader/releases/tag/v5.3.0) page.

## Upgrade Notes

- Minimum Node.js version is now **20.0.0** (previously lower).
- No database format changes — you can install directly over a previous version.

## Known Issues

- ⚠️ **macOS (unsigned):** builds are not yet code-signed/notarized (requires an Apple Developer account). macOS may show an "unidentified developer" warning. To open: right-click → *Open*, or run `xattr -cr /Applications/QBZ\ Downloader.app` in Terminal.
- ⚠️ **macOS Intel (x64) not yet supported:** this release only ships an Apple Silicon (arm64) build. Intel-based Macs are planned for a future release.
- FFmpeg/fpcalc are bundled automatically; if the download fails during build, the app falls back to binaries found on the system PATH.

## Full Changelog

See [CHANGELOG.md](CHANGELOG.md) for full details.
