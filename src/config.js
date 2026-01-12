/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                    QOBUZ DOWNLOADER CONFIGURATION                 ║
 * ║                   Premium Hi-Res Audio Downloader                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

const getBool = (key, def) => process.env[key] === undefined ? def : process.env[key] === 'true';
const getInt = (key, def) => process.env[key] ? parseInt(process.env[key]) : def;
const getStr = (key, def) => process.env[key] || def;

export const CONFIG = {

    credentials: {
        appId: getStr('QOBUZ_APP_ID', ''),
        appSecret: getStr('QOBUZ_APP_SECRET', ''),
        token: getStr('QOBUZ_USER_AUTH_TOKEN', getStr('QOBUZ_TOKEN', '')),
        userId: getStr('QOBUZ_USER_ID', ''),

        spotifyClientId: getStr('SPOTIFY_CLIENT_ID', ''),
        spotifyClientSecret: getStr('SPOTIFY_CLIENT_SECRET', '')
    },


    api: {
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
    },


    quality: {

        formats: {
            5: { name: 'MP3 320', bitDepth: null, sampleRate: null, extension: 'mp3' },
            6: { name: 'FLAC 16-bit/44.1kHz (CD Quality)', bitDepth: 16, sampleRate: 44100, extension: 'flac' },
            7: { name: 'FLAC 24-bit/96kHz (Hi-Res)', bitDepth: 24, sampleRate: 96000, extension: 'flac' },
            27: { name: 'FLAC 24-bit/192kHz (Hi-Res Max)', bitDepth: 24, sampleRate: 192000, extension: 'flac' }
        },

        default: 27
    },


    download: {
        outputDir: getStr('DOWNLOAD_PATH', './downloads'),
        folderStructure: getStr('FOLDER_TEMPLATE', '{artist}/{album}'),
        fileNaming: getStr('FILE_TEMPLATE', '{trackNumber}. {title}'),
        concurrent: getInt('MAX_CONCURRENCY', 4),
        retryAttempts: 3,
        retryDelay: 1000
    },


    metadata: {
        embedCover: getBool('EMBED_COVER_ART', true),
        saveCoverFile: getBool('SAVE_COVER_FILE', true),
        coverSize: 'max',
        embedLyrics: getBool('EMBED_LYRICS', true),
        lyricsType: 'both',


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
    },


    display: {
        showProgress: true,
        showMetadata: true,
        colorScheme: 'gradient',
        verbosity: 'detailed'
    }
};


export const getQualityName = (formatId) => {
    return CONFIG.quality.formats[formatId]?.name || 'Unknown';
};


export const getQualityEmoji = (formatId) => {
    const emojis = {
        5: '🎵',
        6: '💿',
        7: '✨',
        27: '🔥'
    };
    return emojis[formatId] || '🎵';
};

export default CONFIG;
