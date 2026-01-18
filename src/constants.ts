export const URL_PATTERNS = {
    TRACK: new RegExp('qobuz\\.com/[a-z-]+/track/(\\d+)', 'i'),
    ALBUM: new RegExp('qobuz\\.com/[a-z-]+/album/[^/]+/([a-zA-Z0-9]+)', 'i'),
    ARTIST: new RegExp('qobuz\\.com/[a-z-]+/artist/(\\d+)', 'i'),
    PLAYLIST: new RegExp('qobuz\\.com/[a-z-]+/playlist/(\\d+)', 'i'),
    LABEL: new RegExp('qobuz\\.com/[a-z-]+/label/[^/]+/(\\d+)', 'i'),
    NUMERIC_ID: /^\d+$/
};

export const APP_VERSION = '4.0.0';
