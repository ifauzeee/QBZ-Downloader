#!/usr/bin/env node
/**
 * Bundles platform-specific binaries (ffmpeg, fpcalc) into bin/<platform>-<arch>/
 * so electron-builder's extraResources can ship them with the app.
 *
 * - ffmpeg comes from the `ffmpeg-static` npm package (downloads per-platform at install).
 * - fpcalc (Chromaprint) is downloaded from GitHub releases.
 *
 * Failures are non-fatal: the app falls back to system PATH if a binary is missing.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { execSync } = require('child_process');

const platform = process.platform; // win32 | darwin | linux
const arch = process.arch; // x64 | arm64
const ext = platform === 'win32' ? '.exe' : '';
const binDir = path.join(__dirname, '..', 'bin', `${platform}-${arch}`);

fs.mkdirSync(binDir, { recursive: true });

function log(msg) {
  console.log(`[bundle-binaries] ${msg}`);
}

function warn(msg) {
  console.warn(`[bundle-binaries] WARNING: ${msg}`);
}

// ---------------------------------------------------------------------------
// FFmpeg (via ffmpeg-static)
// ---------------------------------------------------------------------------
function bundleFfmpeg() {
  try {
    const ffmpegStatic = require('ffmpeg-static');
    const dest = path.join(binDir, `ffmpeg${ext}`);
    fs.copyFileSync(ffmpegStatic, dest);
    if (platform !== 'win32') execSync(`chmod +x "${dest}"`);
    log(`ffmpeg -> ${dest}`);
    return true;
  } catch (err) {
    warn(`ffmpeg not bundled: ${err.message}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// fpcalc (Chromaprint) via GitHub releases
// ---------------------------------------------------------------------------
const FPCALC_VERSION = '1.5.1';
const FPCALC_BASE = `https://github.com/acoustid/chromaprint/releases/download/v${FPCALC_VERSION}`;

// Returns the list of target arch directories to copy fpcalc into.
function fpcalcTargets() {
  if (platform === 'win32') {
    return [{ url: `${FPCALC_BASE}/chromaprint-fpcalc-${FPCALC_VERSION}-windows-x86_64.zip`, dir: 'win32-x64' }];
  }
  if (platform === 'darwin') {
    // macOS universal binary covers both x64 and arm64
    const url = `${FPCALC_BASE}/chromaprint-fpcalc-${FPCALC_VERSION}-macos-universal.tar.gz`;
    return [
      { url, dir: 'darwin-x64' },
      { url, dir: 'darwin-arm64' },
    ];
  }
  if (platform === 'linux') {
    return [{ url: `${FPCALC_BASE}/chromaprint-fpcalc-${FPCALC_VERSION}-linux-x86_64.tar.gz`, dir: 'linux-x64' }];
  }
  return [];
}

function download(url) {
  const isZip = url.endsWith('.zip');
  return new Promise((resolve, reject) => {
    const tmp = path.join(os.tmpdir(), `fpcalc-${Date.now()}.${isZip ? 'zip' : 'tar.gz'}`);
    const file = fs.createWriteStream(tmp);
    const req = https.get(
      url,
      { headers: { 'Accept-Encoding': 'identity' } },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          const next = new URL(res.headers.location, url).href;
          download(next).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          file.close();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(tmp);
        });
      }
    );
    req.on('error', (e) => {
      file.close();
      reject(e);
    });
  });
}

function findBinary(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findBinary(full, name);
      if (found) return found;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

async function bundleFpcalc() {
  const targets = fpcalcTargets();
  if (targets.length === 0) {
    warn(`unsupported platform ${platform}-${arch} for fpcalc`);
    return false;
  }
  let ok = false;
  for (const target of targets) {
    try {
      log(`downloading fpcalc from ${target.url}`);
      const tmp = await download(target.url);
      const extractDir = path.join(os.tmpdir(), `fpcalc-extract-${Date.now()}`);
      fs.mkdirSync(extractDir, { recursive: true });
      if (target.url.endsWith('.zip')) {
        execSync(
          `powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${tmp}', '${extractDir}')"`
        );
      } else {
        execSync(`tar -xf "${tmp}" -C "${extractDir}"`);
      }
      const found = findBinary(extractDir, `fpcalc${ext}`);
      if (found) {
        const destDir = path.join(__dirname, '..', 'bin', target.dir);
        fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, `fpcalc${ext}`);
        fs.copyFileSync(found, dest);
        if (platform !== 'win32') execSync(`chmod +x "${dest}"`);
        log(`fpcalc -> ${dest}`);
        ok = true;
      } else {
        warn(`fpcalc binary not found in ${target.url}`);
      }
      fs.rmSync(extractDir, { recursive: true, force: true });
      fs.rmSync(tmp, { force: true });
    } catch (err) {
      warn(`fpcalc not bundled (${target.dir}): ${err.message}`);
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const ffmpegOk = bundleFfmpeg();
  const fpcalcOk = await bundleFpcalc();

  if (!ffmpegOk) {
    warn('ffmpeg missing — format conversion & quality scan will be disabled in this build.');
  }
  if (!fpcalcOk) {
    warn('fpcalc missing — audio fingerprinting (duplicate detection) will be disabled in this build.');
  }
  if (ffmpegOk && fpcalcOk) {
    log(`binaries bundled into ${binDir}`);
  }
}

main().catch((err) => {
  warn(`unexpected error: ${err.message}`);
  process.exit(0); // non-fatal
});
