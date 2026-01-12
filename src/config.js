/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║                    QOBUZ DOWNLOADER CONFIGURATION                 ║
 * ║                   Premium Hi-Res Audio Downloader                 ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

export const CONFIG = {

    credentials: {
        appId: process.env.QOBUZ_APP_ID || '',
        appSecret: process.env.QOBUZ_APP_SECRET || '',
        token: process.env.QOBUZ_TOKEN || '',
        userId: process.env.QOBUZ_USER_ID || ''
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
        }
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
        outputDir: './downloads',
        folderStructure: '{artist}/{album}',
        fileNaming: '{trackNumber}. {title}',
        concurrent: 3,
        retryAttempts: 3,
        retryDelay: 1000
    },


    metadata: {
        embedCover: true,
        coverSize: 'max',
        embedLyrics: true,
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
