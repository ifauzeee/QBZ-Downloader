const getSetting = <T>(key: string, def: T): T => {
    const fromEnv = process.env[key];
    if (fromEnv === undefined) return def;
    if (fromEnv === 'true') return true as T;
    if (fromEnv === 'false') return false as T;
    return fromEnv as unknown as T;
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
        streaming: number;
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
            proxy: getStr('PROXY_URL', '')
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
            retryDelay: getInt('RETRY_DELAY', 1000)
        };
    },
    get metadata() {
        return {
            embedCover: getBool('EMBED_COVER_ART', true),
            saveCoverFile: getBool('SAVE_COVER_FILE', true),
            saveLrcFile: getBool('SAVE_LRC_FILE', true),
            coverSize: getStr('COVER_SIZE', 'max'),
            embedLyrics: getBool('EMBED_LYRICS', true),
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
            password: getStr('DASHBOARD_PASSWORD', ''),
            autoCleanHours: getInt('DASHBOARD_AUTO_CLEAN_HOURS', 24)
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
