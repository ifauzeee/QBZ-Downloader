export const API = {
    QOBUZ_BASE_URL: 'https://www.qobuz.com/api.json/0.2',
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

export interface QualityFormat {
    name: string;
    bitDepth: number | null;
    sampleRate: number | null;
    extension: string;
    emoji: string;
}

export const QUALITY_INFO: Record<number, QualityFormat> = {
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
    TRACK: new RegExp('qobuz\\.com/[a-z-]+/track/(\\d+)', 'i'),
    ALBUM: new RegExp('qobuz\\.com/[a-z-]+/album/[^/]+/([a-zA-Z0-9]+)', 'i'),
    ARTIST: new RegExp('qobuz\\.com/[a-z-]+/artist/(\\d+)', 'i'),
    PLAYLIST: new RegExp('qobuz\\.com/[a-z-]+/playlist/(\\d+)', 'i'),
    LABEL: new RegExp('qobuz\\.com/[a-z-]+/label/[^/]+/(\\d+)', 'i'),
    NUMERIC_ID: /^\d+$/
};

export const DEFAULTS = {
    QUALITY: 27,
    OUTPUT_DIR: './downloads',
    FOLDER_TEMPLATE: '{artist}/{album}',
    FILE_TEMPLATE: '{track_number}. {title}',
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
export const APP_VERSION = '2.0.0';
export const APP_NAME = 'Qobuz-DL CLI';
