const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electronVersion = require('electron/package.json').version;
const root = path.resolve(__dirname, '..');

function findRebuildCli() {
    const rel = path.join('@electron', 'rebuild', 'lib', 'cli.js');

    const candidates = [
        path.join(root, 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js'),
        path.join(root, 'node_modules', 'app-builder-lib', 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js'),
        path.join(root, 'node_modules', 'electron-builder', 'node_modules', '@electron', 'rebuild', 'lib', 'cli.js')
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    // Fallback: search for the cli.js anywhere under node_modules (handles either
    // hoisted or nested installs produced by different npm/lockfile layouts).
    const nm = path.join(root, 'node_modules');
    let found = null;
    const walk = (dir, depth) => {
        if (found || depth > 6) return;
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (found) return;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name === 'node_modules' && depth > 0) continue;
                walk(full, depth + 1);
            } else if (entry.isFile() && full.endsWith(rel)) {
                found = full;
                return;
            }
        }
    };
    walk(nm, 0);

    return found;
}

const rebuildCli = findRebuildCli();

if (!rebuildCli) {
    console.error('Could not locate @electron/rebuild/cli.js in node_modules.');
    process.exit(1);
}

const result = spawnSync(
    process.execPath,
    [
        rebuildCli,
        '--force',
        '--which-module',
        'better-sqlite3',
        '--version',
        electronVersion,
        '--module-dir',
        root
    ],
    {
        stdio: 'inherit',
        shell: false
    }
);

if (result.status !== 0) {
    process.exit(result.status || 1);
}
