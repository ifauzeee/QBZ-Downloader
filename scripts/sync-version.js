import { readFileSync, writeFileSync } from 'fs';

const packagePath = 'package.json';
const manifestPath = 'client/public/manifest.json';
const readmePath = 'README.md';
const changelogPath = 'CHANGELOG.md';

const { version } = JSON.parse(readFileSync(packagePath, 'utf-8'));

const clientPackagePath = 'client/package.json';

// 1. Update manifest.json
try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifest.version = version;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + '\n');
    console.log(`✅ Updated ${manifestPath} to v${version}`);
} catch (e) {
    console.error(`Failed to update ${manifestPath}:`, e.message);
}

// 1.5 Update client/package.json
try {
    const clientPackage = JSON.parse(readFileSync(clientPackagePath, 'utf-8'));
    clientPackage.version = version;
    writeFileSync(clientPackagePath, JSON.stringify(clientPackage, null, 2) + '\n');
    console.log(`✅ Updated ${clientPackagePath} to v${version}`);
} catch (e) {
    console.error(`Failed to update ${clientPackagePath}:`, e.message);
}

// 2. Update README.md badge
try {
    let readme = readFileSync(readmePath, 'utf-8');
    // Match the shields.io version badge, keeping the color code
    readme = readme.replace(
        /https:\/\/img\.shields\.io\/badge\/version-\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?-([A-Fa-f0-9]+)/g,
        `https://img.shields.io/badge/version-${version}-$2`
    );
    // Match the highlight text (e.g. "> **🚀 v5.2.0:")
    readme = readme.replace(
        /> \*\*🚀 v\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?/g,
        `> **🚀 v${version}`
    );
    writeFileSync(readmePath, readme);
    console.log(`✅ Updated ${readmePath} to v${version}`);
} catch (e) {
    console.error(`Failed to update ${readmePath}:`, e.message);
}

// 3. Update CHANGELOG.md top entry
try {
    let changelog = readFileSync(changelogPath, 'utf-8');
    let updated = false;
    changelog = changelog.replace(/## \[\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?\]/, (match) => {
        if (!updated) {
            updated = true;
            return `## [${version}]`;
        }
        return match;
    });
    writeFileSync(changelogPath, changelog);
    console.log(`✅ Updated ${changelogPath} to v${version}`);
} catch (e) {
    console.error(`Failed to update ${changelogPath}:`, e.message);
}
