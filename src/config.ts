import { settingsService } from './services/settings.js';

const getSetting = <T>(key: string, def: T): T => {
    const fromDb = settingsService.get(key);
    const raw = fromDb;

    if (raw === undefined) return def;
    if (raw === 'true') return true as T;
    if (raw === 'false') return false as T;
    return raw as unknown as T;
};

const getBool = (key: string, def: boolean): boolean => getSetting<boolean>(key, def);
const getInt = (key: string, def: number): number => {
    const val = getSetting(key, def);
    if (typeof val === 'string') {
        const parsed = parseInt(val);
        return isNaN(parsed) ? def : parsed;
    }
    return val as number;
};
const getStr = (key: string, def: string): string => getSetting<string>(key, def);

export interface Config {
    credentials: {
        appId: string;
        appSecret: string;
        token: string;
        userId: string;
    };
    spotify: {
        clientId: string;
        clientSecret: string;
    };
    api: {
        baseUrl: string;
        endpoints: {
            track: string;
            album: string;
            artist: string;
            playlist: string;
            search: string;
            fileUrl: string;
            userInfo: string;
            favorites: string;
        };
    };
    quality: {
        formats: Record<
            number,
            {
                name: string;
                bitDepth: number | null;
                sampleRate: number | null;
                extension: string;
            }
        >;
        default: number | 'ask' | 'min' | 'max';
        streaming: number;
    };
    download: {
        outputDir: string;
        folderStructure: string;
        fileNaming: string;
        concurrent: number;
        retryAttempts: number;
        retryDelay: number;
        bandwidthLimit: number;
    };
    metadata: {
        embedCover: boolean;
        saveCoverFile: boolean;
        saveLrcFile: boolean;
        coverSize: string;
        embedLyrics: boolean;
        downloadLyrics: boolean;
        lyricsType: string;
        tags: {
            basic: string[];
            extended: string[];
            credits: string[];
        };
    };
    export: {
        enabled: boolean;
        format: 'mp3' | 'aac' | 'opus';
        bitrate: string;
        outputDir?: string;
        keepOriginal: boolean;
    };
    dashboard: {
        port: number;
        password?: string;
    };
    mediaServer: {
        enabled: boolean;
        type: 'plex' | 'jellyfin' | 'webhook' | 'none';
        url: string;
        token: string;
        libraryId?: string;
    };
    ai: {
        enabled: boolean;
        provider: 'gemini' | 'openai' | 'none';
        apiKey: string;
        model: string;
    };
}

export const CONFIG: Config = {
    get credentials() {
        return {
            appId: getStr('QOBUZ_APP_ID', ''),
            appSecret: getStr('QOBUZ_APP_SECRET', ''),
            token: getStr('QOBUZ_USER_AUTH_TOKEN', ''),
            userId: getStr('QOBUZ_USER_ID', '')
        };
    },
    get spotify() {
        return {
            clientId: getStr('SPOTIFY_CLIENT_ID', ''),
            clientSecret: getStr('SPOTIFY_CLIENT_SECRET', '')
        };
    },
    get api() {
        return {
            baseUrl: 'https://www.qobuz.com/api.json/0.2',
            endpoints: {
                track: '/track/get',
                album: '/album/get',
                artist: '/artist/get',
                playlist: '/playlist/get',
                search: '/catalog/search',
                fileUrl: '/track/getFileUrl',
                userInfo: '/user/get',
                favorites: '/favorite/getUserFavorites'
            }
        };
    },

    get quality() {
        const defaultQualityRaw = getStr('DEFAULT_QUALITY', '27');
        const parsed = parseInt(defaultQualityRaw, 10);
        const defaultQuality =
            defaultQualityRaw === 'ask' ||
            defaultQualityRaw === 'min' ||
            defaultQualityRaw === 'max'
                ? (defaultQualityRaw as 'ask' | 'min' | 'max')
                : !isNaN(parsed)
                  ? parsed
                  : 27;

        return {
            formats: {
                5: { name: 'MP3 320', bitDepth: null, sampleRate: null, extension: 'mp3' },
                6: {
                    name: 'FLAC 16-bit/44.1kHz (CD Quality)',
                    bitDepth: 16,
                    sampleRate: 44100,
                    extension: 'flac'
                },
                7: {
                    name: 'FLAC 24-bit/96kHz (Hi-Res)',
                    bitDepth: 24,
                    sampleRate: 96000,
                    extension: 'flac'
                },
                27: {
                    name: 'FLAC 24-bit/192kHz (Hi-Res Max)',
                    bitDepth: 24,
                    sampleRate: 192000,
                    extension: 'flac'
                }
            },
            default: defaultQuality,
            streaming: getInt('STREAMING_QUALITY', 5)
        };
    },

    get download() {
        return {
            outputDir: getStr('DOWNLOADS_PATH', './downloads'),
            folderStructure: getStr('FOLDER_TEMPLATE', '{albumArtist}/{album}'),
            fileNaming: getStr('FILE_TEMPLATE', '{track_number}. {title}'),
            concurrent: getInt('MAX_CONCURRENCY', 2),
            retryAttempts: getInt('RETRY_ATTEMPTS', 3),
            retryDelay: getInt('RETRY_DELAY', 1000),
            bandwidthLimit: getInt('BANDWIDTH_LIMIT', 0)
        };
    },
    get metadata() {
        return {
            embedCover: getBool('EMBED_COVER_ART', true),
            saveCoverFile: getBool('SAVE_COVER_FILE', true),
            saveLrcFile: getBool('SAVE_LRC_FILE', true),
            coverSize: getStr('COVER_SIZE', 'max'),
            embedLyrics: getBool('EMBED_LYRICS', true),
            downloadLyrics: getBool('DOWNLOAD_LYRICS', true),
            lyricsType: getStr('LYRICS_TYPE', 'both'),
            tags: {
                basic: ['title', 'artist', 'album', 'year', 'trackNumber', 'genre'],
                extended: [
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
                    'totalTracks',
                    'bpm',
                    'key',
                    'mood',
                    'media',
                    'releaseType',
                    'releaseDate',
                    'originalReleaseDate',
                    'recordingDate',
                    'country',
                    'language',
                    'encodedBy',
                    'encodingSettings',
                    'replayGain',
                    'comment'
                ],
                credits: [
                    'engineer',
                    'masteredBy',
                    'mixedBy',
                    'producedBy',
                    'arrangedBy',
                    'recordedBy'
                ]
            }
        };
    },

    get dashboard() {
        return {
            port: getInt('DASHBOARD_PORT', 3000),
            password: getStr('DASHBOARD_PASSWORD', '')
        };
    },

    get export() {
        return {
            enabled: getBool('EXPORT_ENABLED', false),
            format: getStr('EXPORT_FORMAT', 'mp3') as any,
            bitrate: getStr('EXPORT_BITRATE', '320k'),
            outputDir: getStr('EXPORT_PATH', ''),
            keepOriginal: getBool('EXPORT_KEEP_ORIGINAL', true)
        };
    },

    get mediaServer() {
        return {
            enabled: getBool('MEDIA_SERVER_ENABLED', false),
            type: getStr('MEDIA_SERVER_TYPE', 'none') as any,
            url: getStr('MEDIA_SERVER_URL', ''),
            token: getStr('MEDIA_SERVER_TOKEN', ''),
            libraryId: getStr('MEDIA_SERVER_LIBRARY_ID', '')
        };
    },

    get ai() {
        return {
            enabled: getBool('AI_REPAIR_ENABLED', false),
            provider: getStr('AI_PROVIDER', 'none') as any,
            apiKey: getStr('AI_API_KEY', ''),
            model: getStr('AI_MODEL', 'gemini-2.0-flash')
        };
    }
};

export const getQualityName = (formatId: number) => {
    return CONFIG.quality.formats[formatId]?.name || 'Unknown';
};

export const getQualityEmoji = (formatId: number) => {
    const emojis: Record<number, string> = {
        5: '🎵',
        6: '💿',
        7: '✨',
        27: '🔥'
    };
    return emojis[formatId] || '🎵';
};

export const normalizeDownloadQuality = (
    value: number | string | null | undefined,
    fallback: number | string | null | undefined = 27
): number => {
    const normalize = (candidate: number | string | null | undefined): number | null => {
        if (typeof candidate === 'number' && Number.isFinite(candidate)) return candidate;
        if (typeof candidate !== 'string') return null;

        const trimmed = candidate.trim().toLowerCase();
        if (!trimmed || trimmed === 'ask') return null;
        if (trimmed === 'max') return 27;
        if (trimmed === 'min') return 5;

        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    };

    return normalize(value) ?? normalize(fallback) ?? 27;
};

export default CONFIG;
