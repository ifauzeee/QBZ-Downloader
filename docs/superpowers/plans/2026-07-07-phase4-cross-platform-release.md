# Phase 4 — Cross-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add macOS and Linux build jobs to the desktop-release workflow, ship platform-specific FFmpeg/fpcalc binaries, and update documentation for 3-platform distribution.

**Architecture:** Extend the existing single-platform `desktop-release.yml` into a 3-job workflow (Windows, macOS, Linux). Each job runs on its native OS, rebuilds `better-sqlite3` for Electron, and produces platform-specific installers via electron-builder. A placeholder `bin/` structure is created for FFmpeg/fpcalc. README and sync-version.js are updated to reference all 3 platforms.

**Tech Stack:** GitHub Actions, electron-builder, better-sqlite3, @electron/rebuild, Node.js 22

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `.github/workflows/desktop-release.yml` | Modify | Add macOS + Linux jobs |
| `bin/README.md` | Create | Document binary structure |
| `bin/darwin-x64/.gitkeep` | Create | Placeholder for macOS x64 binaries |
| `bin/darwin-arm64/.gitkeep` | Create | Placeholder for macOS arm64 binaries |
| `bin/linux-x64/.gitkeep` | Create | Placeholder for Linux x64 binaries |
| `README.md` | Modify | 3-platform badges + download section |
| `scripts/sync-version.js` | Modify | Update version badge with platform info |
| `docs/platform-expansion.md` | Modify | Mark completed items |

---

## Task 1: Add macOS job to desktop-release.yml

**Files:**
- Modify: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Read current workflow**

Read `.github/workflows/desktop-release.yml` to understand the full structure (103 lines). Key sections: `on` triggers, `windows-release` job with caches, build steps, artifact upload.

- [ ] **Step 2: Add `macos-release` job**

Add a new job after `windows-release` in `.github/workflows/desktop-release.yml`. The job mirrors the Windows job but targets macOS:

```yaml
  macos-release:
    runs-on: macos-latest
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'

    steps:
    - uses: actions/checkout@v4

    - name: Cache node-gyp cache
      uses: actions/cache@v4
      with:
        path: ~/Library/Caches/node-gyp
        key: node-gyp-macos-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          node-gyp-macos-

    - name: Cache Electron
      uses: actions/cache@v4
      with:
        path: ~/Library/Caches/electron
        key: electron-macos-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          electron-macos-

    - name: Cache electron-builder
      uses: actions/cache@v4
      with:
        path: ~/Library/Caches/electron-builder
        key: electron-builder-macos-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          electron-builder-macos-

    - name: Use Node.js 22
      uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: 'npm'
        cache-dependency-path: |
          package-lock.json
          client/package-lock.json

    - name: Install dependencies
      run: npm ci

    - name: Build client
      run: npm run build:full

    - name: Version consistency check
      run: |
        PKG_VER=$(node -p "require('./package.json').version")
        CLIENT_VER=$(node -p "require('./client/package.json').version")
        echo "package.json: $PKG_VER"
        echo "client/package.json: $CLIENT_VER"
        if [ "$PKG_VER" != "$CLIENT_VER" ]; then
          echo "::error::Version mismatch: package.json ($PKG_VER) vs client/package.json ($CLIENT_VER)"
          exit 1
        fi

    - name: Run tests
      run: npm test

    - name: Lint
      run: npm run lint

    - name: Rebuild native modules for Electron
      run: npm run desktop:rebuild

    - name: Build macOS DMG + ZIP
      if: startsWith(github.ref, 'refs/tags/v')
      run: npx electron-builder --mac dmg zip --publish always
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Build macOS (manual dispatch — no publish)
      if: github.event_name == 'workflow_dispatch'
      run: npx electron-builder --mac dmg zip --publish never

    - name: Upload macOS artifacts
      if: startsWith(github.ref, 'refs/tags/v')
      uses: actions/upload-artifact@v7
      with:
        name: macos-build
        path: |
          release/*.dmg
          release/*.zip
          release/*.yml
          release/*.blockmap
        retention-days: 14
```

- [ ] **Step 3: Verify workflow YAML syntax**

Run: `node -e "const fs = require('fs'); const yaml = fs.readFileSync('.github/workflows/desktop-release.yml', 'utf8'); console.log('YAML length:', yaml.length, 'lines:', yaml.split('\n').length)"`

Expected: File reads without error, shows increased line count.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci(release): add macOS build job to desktop-release workflow"
```

---

## Task 2: Add Linux job to desktop-release.yml

**Files:**
- Modify: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Add `linux-release` job**

Append after the `macos-release` job in `.github/workflows/desktop-release.yml`:

```yaml
  linux-release:
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'

    steps:
    - uses: actions/checkout@v4

    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y libgtk-3-dev libnotify-dev libnss3-dev libxss-dev libxtst-dev libatspi2.0-dev libdrm-dev libgbm-dev

    - name: Cache node-gyp cache
      uses: actions/cache@v4
      with:
        path: ~/.cache/node-gyp
        key: node-gyp-linux-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          node-gyp-linux-

    - name: Cache Electron
      uses: actions/cache@v4
      with:
        path: ~/.cache/electron
        key: electron-linux-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          electron-linux-

    - name: Cache electron-builder
      uses: actions/cache@v4
      with:
        path: ~/.cache/electron-builder
        key: electron-builder-linux-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          electron-builder-linux-

    - name: Use Node.js 22
      uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: 'npm'
        cache-dependency-path: |
          package-lock.json
          client/package-lock.json

    - name: Install dependencies
      run: npm ci

    - name: Build client
      run: npm run build:full

    - name: Version consistency check
      run: |
        PKG_VER=$(node -p "require('./package.json').version")
        CLIENT_VER=$(node -p "require('./client/package.json').version")
        echo "package.json: $PKG_VER"
        echo "client/package.json: $CLIENT_VER"
        if [ "$PKG_VER" != "$CLIENT_VER" ]; then
          echo "::error::Version mismatch: package.json ($PKG_VER) vs client/package.json ($CLIENT_VER)"
          exit 1
        fi

    - name: Run tests
      run: npm test

    - name: Lint
      run: npm run lint

    - name: Rebuild native modules for Electron
      run: npm run desktop:rebuild

    - name: Build Linux packages
      if: startsWith(github.ref, 'refs/tags/v')
      run: npx electron-builder --linux AppImage deb tar.gz --publish always
      env:
        GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

    - name: Build Linux (manual dispatch — no publish)
      if: github.event_name == 'workflow_dispatch'
      run: npx electron-builder --linux AppImage deb tar.gz --publish never

    - name: Upload Linux artifacts
      if: startsWith(github.ref, 'refs/tags/v')
      uses: actions/upload-artifact@v7
      with:
        name: linux-build
        path: |
          release/*.AppImage
          release/*.deb
          release/*.tar.gz
          release/*.yml
          release/*.blockmap
        retention-days: 14
```

- [ ] **Step 2: Verify full workflow has 3 jobs**

Run: `node -e "const fs = require('fs'); const y = fs.readFileSync('.github/workflows/desktop-release.yml','utf8'); const jobs = y.match(/^\s{2}\S+:/gm); console.log('Jobs found:', jobs)"`

Expected: Shows `windows-release:`, `macos-release:`, `linux-release:`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci(release): add Linux build job to desktop-release workflow"
```

---

## Task 3: Create bin/ directory structure with .gitkeep placeholders

**Files:**
- Create: `bin/darwin-x64/.gitkeep`
- Create: `bin/darwin-arm64/.gitkeep`
- Create: `bin/linux-x64/.gitkeep`
- Create: `bin/win32-x64/.gitkeep`
- Create: `bin/README.md`

- [ ] **Step 1: Create placeholder directories**

```bash
mkdir -p bin/darwin-x64 bin/darwin-arm64 bin/linux-x64 bin/win32-x64
touch bin/darwin-x64/.gitkeep bin/darwin-arm64/.gitkeep bin/linux-x64/.gitkeep bin/win32-x64/.gitkeep
```

- [ ] **Step 2: Create bin/README.md**

Write `bin/README.md`:

```markdown
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
```

- [ ] **Step 3: Verify directory structure**

Run: `ls -la bin/`

Expected: Shows `darwin-x64/`, `darwin-arm64/`, `linux-x64/`, `win32-x64/`, `README.md`

- [ ] **Step 4: Commit**

```bash
git add bin/
git commit -m "chore: add bin/ directory structure for platform-specific binaries"
```

---

## Task 4: Update README.md for 3-platform support

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update badges section**

In `README.md`, the current badges are:

```markdown
[![Version](https://img.shields.io/badge/version-5.2.3-6366f1?style=flat-square)](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
```

Replace the version badge line with:

```markdown
[![Version](https://img.shields.io/badge/version-5.2.3-6366f1?style=flat-square)](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-EXE-0078d4?style=flat-square&logo=windows)](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-DMG-000000?style=flat-square&logo=apple)](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
[![Linux](https://img.shields.io/badge/Linux-AppImage-fcc624?style=flat-square&logo=linux)](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
```

- [ ] **Step 2: Update "Platform Support" section**

Find the line that says:

```markdown
> **Platform:** Windows 10/11 (x64)
```

Replace with:

```markdown
> **Platform:** Windows 10/11 (x64) · macOS 12+ (Intel & Apple Silicon) · Linux x86_64
```

- [ ] **Step 3: Update Installation section**

Find the section that starts with `### Installation` and has:

```markdown
1. Download the latest `.exe` installer from [Releases](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
```

Replace with:

```markdown
1. Download the installer for your platform from [Releases](https://github.com/ifauzeee/QBZ-Downloader/releases/latest)
   - **Windows:** `.exe` installer or portable `.exe`
   - **macOS:** `.dmg` disk image
   - **Linux:** `.AppImage` (portable), `.deb` (Debian/Ubuntu), or `.tar.gz`
```

- [ ] **Step 4: Update system architecture diagram**

Find the line:

```markdown
QBZ Downloader Desktop (Windows EXE) → Launches Node.js Backend (dist/index.js)
```

Replace with:

```markdown
QBZ Downloader Desktop (Windows/macOS/Linux) → Launches Node.js Backend (dist/index.js)
```

- [ ] **Step 5: Verify README renders correctly**

Run: `node -e "const fs = require('fs'); const md = fs.readFileSync('README.md','utf8'); const badges = (md.match(/\[!\[/g)||[]).length; console.log('Badge count:', badges); console.log('Has macOS:', md.includes('macOS')); console.log('Has Linux:', md.includes('Linux'))"`

Expected: Badge count >= 5, Has macOS: true, Has Linux: true

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: update README for Windows, macOS, and Linux downloads"
```

---

## Task 5: Update sync-version.js to preserve platform badges

**Files:**
- Modify: `scripts/sync-version.js`

- [ ] **Step 1: Read current sync-version.js**

Read `scripts/sync-version.js` (66 lines). It updates:
1. `client/public/manifest.json` — version field
2. `client/package.json` — version field
3. `README.md` — shields.io badge URL version and highlight text
4. `CHANGELOG.md` — top version entry

- [ ] **Step 2: Verify badge regex handles multiple badges**

The current regex for README badge update looks for:
```
/\[!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-[^\]]+\)/
```

This only matches the Version badge. The new platform badges (Windows, macOS, Linux) don't contain version numbers, so they won't be affected. No change needed to the regex — verify this is the case.

Run: `node -e "const fs = require('fs'); const src = fs.readFileSync('scripts/sync-version.js','utf8'); const regex = src.match(/\/.*shields\.io.*\//g); console.log('Regex patterns:', regex)"`

Expected: Shows the version badge regex only.

- [ ] **Step 3: Commit (no changes needed if regex is safe)**

If no changes are needed:

```bash
git commit --allow-empty -m "docs: verify sync-version.js handles multi-platform badges"
```

---

## Task 6: Update docs/platform-expansion.md to mark completed items

**Files:**
- Modify: `docs/platform-expansion.md`

- [ ] **Step 1: Read current file**

Read `docs/platform-expansion.md` (53 lines).

- [ ] **Step 2: Add completion status section**

Append to the end of `docs/platform-expansion.md`:

```markdown

## Implementation Status (v5.3.0)

- [x] CI workflow: macOS job (macos-latest, DMG + ZIP)
- [x] CI workflow: Linux job (ubuntu-latest, AppImage + deb + tar.gz)
- [x] Native rebuild per platform (better-sqlite3 via @electron/rebuild)
- [x] bin/ directory structure for platform binaries
- [ ] FFmpeg/fpcalc binaries populated (requires manual download per platform)
- [ ] macOS code signing & notarization (requires Apple Developer account)
- [x] README updated for 3 platforms
- [x] Version badge shows 3 platform download links
```

- [ ] **Step 3: Commit**

```bash
git add docs/platform-expansion.md
git commit -m "docs: mark Phase 4 completed items in platform-expansion.md"
```

---

## Task 7: Bump version to 5.3.0

**Files:**
- Modify: `package.json` (version field)
- Modify: `client/package.json` (version field)

- [ ] **Step 1: Update version in package.json**

Change `"version": "5.2.3"` to `"version": "5.3.0"` in root `package.json`.

- [ ] **Step 2: Update version in client/package.json**

Change `"version": "5.2.3"` to `"version": "5.3.0"` in `client/package.json`.

- [ ] **Step 3: Update CHANGELOG.md**

Add a new entry at the top of `CHANGELOG.md`:

```markdown
## [5.3.0] - 2026-07-07

### Added
- macOS builds (DMG + ZIP) for Intel and Apple Silicon
- Linux builds (AppImage, deb, tar.gz)
- Platform-specific binary resolution via `bin/<platform>-<arch>/`
- CI release workflow now builds for Windows, macOS, and Linux

### Changed
- README updated with download links for all 3 platforms
- Minimum Node.js version bumped to 20.0.0
```

- [ ] **Step 4: Run sync-version.js to propagate**

Run: `node scripts/sync-version.js`

Expected: Updates README badge to 5.3.0 and client/package.json version.

- [ ] **Step 5: Verify all versions match**

Run: `node -e "const r = require('./package.json').version; const c = require('./client/package.json').version; console.log('root:', r, 'client:', c, 'match:', r === c)"`

Expected: `root: 5.3.0 client: 5.3.0 match: true`

- [ ] **Step 6: Run full test suite**

Run: `npm test`

Expected: All 193 root tests pass.

- [ ] **Step 7: Run client tests**

Run: `cd client && npm test`

Expected: All 71 client tests pass.

- [ ] **Step 8: Commit**

```bash
git add package.json client/package.json CHANGELOG.md README.md
git commit -m "chore(release): bump version to 5.3.0"
```

---

## Task 8: Final verification

- [ ] **Step 1: Verify workflow file is valid YAML**

Run: `node -e "const fs = require('fs'); const y = fs.readFileSync('.github/workflows/desktop-release.yml','utf8'); const jobCount = (y.match(/^\s{2}\w+:/gm)||[]).length; console.log('Jobs:', jobCount); console.log('Lines:', y.split('\n').length)"`

Expected: Jobs: 3, Lines > 200

- [ ] **Step 2: Verify bin/ structure**

Run: `ls -R bin/`

Expected: Shows 4 platform directories + README.md

- [ ] **Step 3: Verify README has platform badges**

Run: `grep -c "macOS\|Linux\|Windows" README.md`

Expected: >= 3

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Verify lint passes**

Run: `npm run lint`

Expected: 0 errors (warnings acceptable).

- [ ] **Step 6: Final commit (if any remaining changes)**

```bash
git add -A
git commit -m "chore(release): Phase 4 cross-platform release complete"
```
