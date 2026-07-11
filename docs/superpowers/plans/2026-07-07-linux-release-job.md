# Linux Release Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `linux-release` job to the desktop-release workflow that builds Linux AppImage, deb, and tar.gz artifacts.

**Architecture:** Append a new job after the existing `macos-release` job in the workflow file. The job will follow the same structure as macOS but with Linux-specific dependencies, cache paths, and build targets.

**Tech Stack:** GitHub Actions, Electron Builder, Ubuntu

---

### Task 1: Add Linux Release Job

**Files:**
- Modify: `.github/workflows/desktop-release.yml:198` (append after macos-release)

- [ ] **Step 1: Append the linux-release job**

Add the following YAML content after line 198 (end of macos-release job):

```yaml
  linux-release:
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/v') || github.event_name == 'workflow_dispatch'
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install system dependencies
        run: |
          sudo apt-get update
          sudo apt-get install -y libgtk-3-dev libnotify-dev libnss3-dev libxss-dev libxtst-dev libatspi2.0-dev libdrm-dev libgbm-dev

      - name: Cache node-gyp cache
        uses: actions/cache@v4
        with:
          path: ~/.cache/node-gyp
          key: node-gyp-linux-22-${{ hashFiles('package-lock.json') }}
          restore-keys: |
            node-gyp-linux-22-
            node-gyp-linux-

      - name: Cache Electron
        uses: actions/cache@v4
        with:
          path: ~/.cache/electron
          key: electron-${{ hashFiles('package-lock.json') }}
          restore-keys: electron-

      - name: Cache electron-builder
        uses: actions/cache@v4
        with:
          path: ~/.cache/electron-builder
          key: electron-builder-${{ hashFiles('package-lock.json') }}
          restore-keys: electron-builder-

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: |
            package-lock.json
            client/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Build full project
        run: npm run build:full

      - name: Verify version consistency
        run: |
          node -e "
            const r=require('./package.json').version;
            const c=require('./client/package.json').version;
            const m=require('./client/public/manifest.json').version;
            console.log('root:'+r+' client:'+c+' manifest:'+m);
            if(r!==c||r!==m){console.error('Version mismatch!');process.exit(1);}
            console.log('All versions consistent: '+r);
          "

      - name: Run backend tests
        run: npm test

      - name: Run frontend lint
        run: npm run lint
        working-directory: client

      - name: Run frontend tests
        run: npm test
        working-directory: client

      - name: Rebuild native modules for Electron
        run: npm run desktop:rebuild

      - name: Publish to GitHub Releases (tag only)
        if: startsWith(github.ref, 'refs/tags/v')
        run: npx electron-builder --linux AppImage deb tar.gz --publish always
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build artifacts only (manual dispatch)
        if: ${{ !startsWith(github.ref, 'refs/tags/v') }}
        run: npx electron-builder --linux AppImage deb tar.gz --publish never

      - name: Upload Linux artifacts
        if: startsWith(github.ref, 'refs/tags/v')
        uses: actions/upload-artifact@v7
        with:
          name: linux-build
          retention-days: 14
          path: |
            release/*.AppImage
            release/*.deb
            release/*.tar.gz
            release/*.yml
            release/*.blockmap
```

- [ ] **Step 2: Verify the YAML syntax**

Run the verification command to ensure jobs are correctly parsed:

```bash
node -e "const fs = require('fs'); const y = fs.readFileSync('.github/workflows/desktop-release.yml','utf8'); const jobs = y.match(/^\s{2}\S+:/gm); console.log('Jobs:', jobs)"
```

Expected output: `Jobs: [ '  windows-release:', '  macos-release:', '  linux-release:' ]`

- [ ] **Step 3: Commit the changes**

```bash
git add .github/workflows/desktop-release.yml
git commit -m "ci(release): add Linux build job to desktop-release workflow"
```