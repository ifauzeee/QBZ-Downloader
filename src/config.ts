import { settingsService } from './services/settings.js';

const getSetting = (key: string, def: any): any => {
    const fromSettings = settingsService.get(key);
    if (fromSettings !== undefined) return fromSettings;

    const fromEnv = process.env[key];
    if (fromEnv === undefined) return def;
    if (fromEnv === 'true') return true;
    if (fromEnv === 'false') return false;
    return fromEnv;
};

const getBool = (key: string, def: boolean): boolean => {
    const val = getSetting(key, def);
    return typeof val === 'boolean' ? val : val === 'true';
};

const getInt = (key: string, def: number): number => {
    const val = getSetting(key, def);
    return typeof val === 'number' ? val : parseInt(val as string) || def;
};

const getStr = (key: string, def: string): string => {
    const val = getSetting(key, def);
    return val !== undefined ? String(val) : def;
};

export interface Config {
    credentials: {
        appId: string;
        appSecret: string;
        token: string;
        userId: string;
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
        proxy: string;
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
    };
    download: {
        outputDir: string;
        folderStructure: string;
        fileNaming: string;
        concurrent: number;
        retryAttempts: number;
        retryDelay: number;
    };
    metadata: {
        embedCover: boolean;
        saveCoverFile: boolean;
        saveLrcFile: boolean;
        coverSize: string;
        embedLyrics: boolean;
        lyricsType: string;
        tags: {
            basic: string[];
            extended: string[];
            credits: string[];
        };
    };
    display: {
        showProgress: boolean;
        showMetadata: boolean;
        colorScheme: string;
        verbosity: string;
    };
    telegram: {
        token?: string;
        chatId?: string;
        uploadFiles?: boolean;
        autoDelete?: boolean;
        allowedUsers?: string[];
    };
    dashboard: {
        port: number;
        password?: string;
        autoCleanHours: number;
    };
}

export const CONFIG: Config = {
    get credentials() {
        return {
            appId: getStr('QOBUZ_APP_ID', ''),
            appSecret: getStr('QOBUZ_APP_SECRET', ''),
            token: getStr('QOBUZ_USER_AUTH_TOKEN', getStr('QOBUZ_TOKEN', '')),
            userId: getStr('QOBUZ_USER_ID', '')
        };
    },

    get api() {
        const s = settingsService.settings;
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
            },
            proxy: s.downloads?.proxy || getStr('PROXY_URL', '')
        };
    },

    get quality() {
        const s = settingsService.settings;
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
            default: (s.defaultQuality as any) || 27
        };
    },

    get download() {
        const s = settingsService.settings;
        return {
            outputDir: s.downloads?.path || getStr('DOWNLOADS_PATH', './downloads'),
            folderStructure:
                s.downloads?.folderTemplate || getStr('FOLDER_TEMPLATE', '{artist}/{album}'),
            fileNaming:
                s.downloads?.fileTemplate || getStr('FILE_TEMPLATE', '{track_number}. {title}'),
            concurrent: s.downloads?.concurrent || getInt('MAX_CONCURRENCY', 1),
            retryAttempts: s.downloads?.retryAttempts || 3,
            retryDelay: s.downloads?.retryDelay || 1000
        };
    },

    get metadata() {
        const s = settingsService.settings;
        return {
            embedCover: s.embedCover ?? getBool('EMBED_COVER_ART', true),
            saveCoverFile: s.metadata?.saveCoverFile ?? getBool('SAVE_COVER_FILE', true),
            saveLrcFile: s.metadata?.saveLrcFile ?? getBool('SAVE_LRC_FILE', true),
            coverSize: s.metadata?.coverSize || 'max',
            embedLyrics: s.embedLyrics ?? getBool('EMBED_LYRICS', true),
            lyricsType: s.metadata?.lyricsType || 'both',
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

    get display() {
        const s = settingsService.settings;
        return {
            showProgress: s.display?.showProgress ?? true,
            showMetadata: s.display?.showMetadata ?? true,
            colorScheme: s.display?.colorScheme || 'gradient',
            verbosity: s.display?.verbosity || 'detailed'
        };
    },

    get telegram() {
        const s = settingsService.settings;
        return {
            token: getStr('TELEGRAM_BOT_TOKEN', ''),
            chatId: getStr('TELEGRAM_CHAT_ID', ''),
            uploadFiles: s.telegram?.uploadFiles ?? getBool('TELEGRAM_UPLOAD_FILES', true),
            autoDelete: s.telegram?.autoDelete ?? getBool('TELEGRAM_AUTO_DELETE', true),
            allowedUsers: (s.telegram?.allowedUsers || getStr('TELEGRAM_ALLOWED_USERS', ''))
                .split(',')
                .map((u) => u.trim())
                .filter((u) => u.length > 0)
        };
    },

    get dashboard() {
        const s = settingsService.settings;
        const d = s.dashboard as any;
        return {
            port: d?.port || getInt('DASHBOARD_PORT', 3000),
            password: d?.password || getStr('DASHBOARD_PASSWORD', ''),
            autoCleanHours: d?.autoCleanHours || getInt('DASHBOARD_AUTO_CLEAN_HOURS', 24)
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

export default CONFIG;
