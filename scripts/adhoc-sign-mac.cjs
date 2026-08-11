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

// Each entry is a complete 4-byte header magic. A file matches when its first
// four bytes equal ONE of these — comparing against the concatenation of all
// four (as a single flat list) can never match a real header.
const MACHO_MAGICS = [
    Buffer.from([0xcf, 0xfa, 0xed, 0xfe]), // MH_MAGIC_64
    Buffer.from([0xfe, 0xed, 0xfa, 0xcf]), // MH_CIGAM_64
    Buffer.from([0xca, 0xfe, 0xba, 0xbe]), // FAT_MAGIC
    Buffer.from([0xbe, 0xba, 0xfe, 0xca]) // FAT_CIGAM
];

function isMachO(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
        const buf = Buffer.alloc(4);
        const read = fs.readSync(fd, buf, 0, 4, 0);
        if (read < 4) return false;
        return MACHO_MAGICS.some((magic) => buf.equals(magic));
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
    if (binaries.length === 0) {
        // The main executable alone guarantees at least one hit; zero means the
        // walk or the header check is broken, and shipping now produces exactly
        // the "damaged" bundle this hook exists to prevent.
        throw new Error('[adhoc-sign-mac] no Mach-O binaries found to sign — refusing to ship an unsigned bundle');
    }

    // The outer .app is not visited by collect() (it walks the bundle's
    // contents), and it is the one seal Gatekeeper actually reads. Without it
    // the bundle has no Contents/_CodeSignature and codesign reports
    // "code has no resources but signature indicates they must be present".
    const targets = [...bundles, ...binaries].sort(byDepthDesc);
    targets.push(appPath);

    console.info(
        `[adhoc-sign-mac] Ad-hoc signing ${targets.length} targets (${binaries.length} binaries, ${bundles.length} nested bundles, 1 app)...`
    );

    const entitlements = path.join(context.packager.projectDir, 'assets', 'desktop', 'entitlements.mac.plist');
    const hasEntitlements = fs.existsSync(entitlements);

    // Entitlements belong on the app and its helper apps, not on frameworks,
    // dylibs or loose executables. --options=runtime is deliberately omitted:
    // the hardened runtime only buys anything once the build is notarized, and
    // on an ad-hoc signature it adds launch-time library-validation failures.
    const signArgsFor = (target) => {
        const args = ['--force', '--sign', '-', '--timestamp=none'];
        if (hasEntitlements && target.endsWith('.app')) {
            args.push('--entitlements', entitlements);
        }
        return args;
    };

    try {
        for (const target of targets) {
            execFileSync('codesign', [...signArgsFor(target), target], { stdio: 'inherit' });
        }
    } catch (error) {
        // Ad-hoc signing failures leave the user with a repeat of the "damaged"
        // report, so fail the build loudly rather than shipping a broken bundle.
        console.error('[adhoc-sign-mac] Ad-hoc codesign failed:', error.message);
        throw error;
    }

    // Verify rather than assume. The previous version of this hook silently
    // signed nothing at all for months; a build that cannot verify must not
    // reach a release.
    try {
        execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], {
            stdio: 'inherit'
        });
    } catch (error) {
        console.error('[adhoc-sign-mac] signature verification failed:', error.message);
        throw error;
    }

    console.info('[adhoc-sign-mac] finished Ad-hoc signing of ' + appBundle + ' (signature verified)');
};

// Exposed for scripts/adhoc-sign-mac.test.mjs. A silently-false isMachO shipped
// an unsigned bundle for several releases, so the predicate is pinned by a test.
module.exports.__test = { isMachO };
