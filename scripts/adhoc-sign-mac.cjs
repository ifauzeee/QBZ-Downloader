// electron-builder afterPack hook.
//
// Ad-hoc signs every Mach-O binary inside the .app bundle so macOS does not
// reject the app as "damaged" when it is downloaded with a quarantine
// attribute. When a real Developer ID identity is configured (CSC_LINK or a
// local Keychain cert) electron-builder performs the authoritative signing
// AFTER this hook runs, which replaces these ad-hoc signatures — so this hook
// is a no-op then and cannot conflict with proper signing.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MACHO_MAGIC = [
    0xcf, 0xfa, 0xed, 0xfe, // MH_MAGIC_64
    0xfe, 0xed, 0xfa, 0xcf, // MH_CIGAM_64
    0xca, 0xfe, 0xba, 0xbe, // FAT_MAGIC
    0xbe, 0xba, 0xfe, 0xca // FAT_CIGAM
];

function isMachO(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        return MACHO_MAGIC.every((byte, i) => buf[i] === byte);
    } catch {
        return false;
    } finally {
        if (fd !== undefined) fs.closeSync(fd);
    }
}

function collect(dir, files, bundles) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isSymbolicLink()) continue; // .framework version links handled by the bundle seal
        if (entry.isDirectory()) {
            if (entry.name.endsWith('.app') || entry.name.endsWith('.framework')) {
                bundles.push(full);
            }
            collect(full, files, bundles);
        } else {
            files.push(full);
        }
    }
}

// Deepest path first so nested bundles are signed before their parents.
function byDepthDesc(a, b) {
    return countSeparators(b) - countSeparators(a);
}

function countSeparators(p) {
    let n = 0;
    for (const ch of p) if (ch === path.sep) n += 1;
    return n;
}

module.exports = async function afterPack(context) {
    if (process.platform !== 'darwin' || context.packager.platform.name !== 'mac') {
        return;
    }

    const appOutDir = context.appOutDir;
    const appBundle = fs.readdirSync(appOutDir).find((f) => f.endsWith('.app'));
    if (!appBundle) {
        console.warn('[adhoc-sign-mac] no .app bundle found in appOutDir, skipping Ad-Hoc signature');
        return;
    }
    const appPath = path.join(appOutDir, appBundle);

    if (process.env.CSC_LINK) {
        console.info('[adhoc-sign-mac] real signing identity configured (CSC_LINK), skipping Ad-hoc pass');
        return;
    }

    const files = [];
    const bundles = [];
    collect(appPath, files, bundles);

    const binaries = files.filter(isMachO);
    if (binaries.length === 0 && bundles.length === 0) {
        console.warn('[adhoc-sign-mac] no Mach-O binaries found to sign (unexpected)');
        return;
    }

    const targets = [...bundles, ...binaries].sort(byDepthDesc);
    console.info(`[adhoc-sign-mac] Ad-hoc signing ${targets.length} targets (${binaries.length} binaries, ${bundles.length} bundles)...`);

    const entitlements = path.join(context.projectDir, 'assets', 'desktop', 'entitlements.mac.plist');
    const entitlementsFlag = fs.existsSync(entitlements) ? ['--entitlements', entitlements] : [];
    const signArgs = ['--force', '--sign', '-', '--timestamp=none', '--options=runtime', ...entitlementsFlag];

    try {
        for (const target of targets) {
            execFileSync('codesign', [...signArgs, target], { stdio: 'inherit' });
        }
        console.info('[adhoc-sign-mac] finished Ad-hoc signing of ' + appBundle);
    } catch (error) {
        // Ad-hoc signing failures leave the user with a repeat of the "damaged"
        // report, so fail the build loudly rather than shipping a broken bundle.
        console.error('[adhoc-sign-mac] Ad-hoc codesign failed:', error.message);
        throw error;
    }
};