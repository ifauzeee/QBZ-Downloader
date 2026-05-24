const { spawnSync } = require('child_process');
const path = require('path');

const electronVersion = require('electron/package.json').version;
const rebuildCli = path.resolve(
  __dirname,
  '..',
  'node_modules',
  'app-builder-lib',
  'node_modules',
  '@electron',
  'rebuild',
  'lib',
  'cli.js'
);

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
    path.resolve(__dirname, '..')
  ],
  {
    stdio: 'inherit',
    shell: false
  }
);

if (result.status !== 0) {
  process.exit(result.status || 1);
}
