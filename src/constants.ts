import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

export const URL_PATTERNS = {
    TRACK: new RegExp('qobuz\\.com/[a-z-]+/track/(\\d+)', 'i'),
    ALBUM: new RegExp('qobuz\\.com/[a-z-]+/album/[^/]+/([a-zA-Z0-9]+)', 'i'),
    ARTIST: new RegExp('qobuz\\.com/[a-z-]+/artist/(\\d+)', 'i'),
    PLAYLIST: new RegExp('qobuz\\.com/[a-z-]+/playlist/(\\d+)', 'i'),
    LABEL: new RegExp('qobuz\\.com/[a-z-]+/label/[^/]+/(\\d+)', 'i'),
    NUMERIC_ID: /^\d+$/
};

export const APP_VERSION = packageJson.version;


