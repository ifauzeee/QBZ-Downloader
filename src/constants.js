export const API = {
    QOBUZ_BASE_URL: 'https://www.qobuz.com/api.json/0.2',
    SPOTIFY_AUTH_URL: 'https://accounts.spotify.com/api/token',
    SPOTIFY_API_URL: 'https://api.spotify.com/v1',
    ITUNES_API_URL: 'https://itunes.apple.com',
    MUSICBRAINZ_API_URL: 'https://musicbrainz.org/ws/2',
    LRCLIB_API_URL: 'https://lrclib.net/api'
};

export const ENDPOINTS = {
    TRACK: '/track/get',
    ALBUM: '/album/get',
    ARTIST: '/artist/get',
    PLAYLIST: '/playlist/get',
    SEARCH: '/catalog/search',
    FILE_URL: '/track/getFileUrl',
    USER_INFO: '/user/get',
    FAVORITES: '/favorite/getUserFavorites'
};

export const QUALITY = {
    MP3_320: 5,
    CD: 6,
    HIRES: 7,
    HIRES_MAX: 27
};

export const QUALITY_INFO = {
    5: { name: 'MP3 320', bitDepth: null, sampleRate: null, extension: 'mp3', emoji: '🎵' },
    6: {
        name: 'FLAC 16-bit/44.1kHz (CD Quality)',
        bitDepth: 16,
        sampleRate: 44100,
        extension: 'flac',
        emoji: '💿'
    },
    7: {
        name: 'FLAC 24-bit/96kHz (Hi-Res)',
        bitDepth: 24,
        sampleRate: 96000,
        extension: 'flac',
        emoji: '✨'
    },
    27: {
        name: 'FLAC 24-bit/192kHz (Hi-Res Max)',
        bitDepth: 24,
        sampleRate: 192000,
        extension: 'flac',
        emoji: '🔥'
    }
};

export const URL_PATTERNS = {
    TRACK: new RegExp('/track/(\\d+)'),
    ALBUM: new RegExp('/album/[^/]+/([a-zA-Z0-9]+)'),
    ARTIST: new RegExp('/artist/(\\d+)'),
    PLAYLIST: new RegExp('/playlist/(\\d+)'),
    LABEL: new RegExp('/label/[^/]+/(\\d+)'),
    NUMERIC_ID: /^\d+$/
};

export const DEFAULTS = {
    QUALITY: 27,
    OUTPUT_DIR: './downloads',
    FOLDER_TEMPLATE: '{artist}/{album}',
    FILE_TEMPLATE: '{track_number} {title}',
    MAX_CONCURRENCY: 4,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    REQUEST_TIMEOUT: 30000,
    DOWNLOAD_TIMEOUT: 300000
};

export const METADATA_TAGS = {
    BASIC: ['title', 'artist', 'album', 'year', 'trackNumber', 'genre'],
    EXTENDED: [
        'albumArtist',
        'composer',
        'conductor',
        'producer',
        'mixer',
        'remixer',
        'lyricist',
        'writer',
        'performer',
        'label',
        'copyright',
        'isrc',
        'upc',
        'barcode',
        'catalogNumber',
        'discNumber',
        'totalDiscs',
        'totalTracks'
    ],
    CREDITS: ['engineer', 'masteredBy', 'mixedBy', 'producedBy', 'arrangedBy', 'recordedBy']
};

export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'Qobuz-DL CLI';
