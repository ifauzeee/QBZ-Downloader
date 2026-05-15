import NodeID3 from 'node-id3';
import flac from 'flac-metadata';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { Track, Album, Artist, LyricsResult } from '../types/qobuz.js';

export type RawData = Record<string, unknown>;

export interface Metadata {
    title: string;
    artist: string;
    album: string;
    year: string | number;
    trackNumber: number | string;
    totalTracks: number | string;
    discNumber: number | string;
    totalDiscs: number | string;
    genre: string;

    albumArtist: string;
    composer: string;
    conductor: string;
    producer: string;
    mixer: string;
    remixer: string;
    lyricist: string;
    writer: string;
    arranger: string;
    engineer: string;

    label: string;
    copyright: string;
    isrc: string;
    upc: string;
    barcode: string;
    catalogNumber: string;

    releaseDate: string;
    originalReleaseDate: string;
    releaseType: string;
    version: string;

    duration: number;
    durationFormatted: string;
    bitDepth: number;
    sampleRate: number;
    bitrate: number;
    channels: number;

    qobuzTrackId: string;
    qobuzAlbumId: string;
    qobuzArtistId: string;
    streamable: boolean;
    hiresStreamable: boolean;
    hiresAvailable: boolean;
    parental: boolean;

    coverUrl: string;

    description: string;
    comment: string;
    encodedBy: string;

    performers: RawData;
    credits: RawData;
    allArtists: string[];

    rawTrack: RawData;
    rawAlbum: RawData;

    replayGain?: string;
}
export class MetadataService {

    supportedFormats: string[];

    constructor() {
        this.supportedFormats = ['flac', 'mp3', 'm4a'];
    }

    normalizeName(name: string) {
        if (!name) return '';
        return name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/-/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    joinWithAnd(names: string[]): string {
        if (!names || names.length === 0) return '';
        const filteredNames = names.filter(Boolean);
        if (filteredNames.length === 0) return '';
        if (filteredNames.length === 1) return filteredNames[0];
        if (filteredNames.length === 2) return `${filteredNames[0]} & ${filteredNames[1]}`;
        const last = filteredNames.pop();
        return `${filteredNames.join(', ')} & ${last}`;
    }

    selectCoverUrl(image: RawData = {}, preferredSize = 'max'): string {
        return this.getCoverUrlCandidates(image, preferredSize)[0] || '';
    }

    getCoverUrlCandidates(image: RawData = {}, preferredSize = 'max', seedUrl = ''): string[] {
        const size = (preferredSize || 'max').toLowerCase();
        const fieldOrder =
            size === 'small'
                ? ['small', 'thumbnail', 'large', 'extralarge', 'mega']
                : size === 'large'
                  ? ['large', 'extralarge', 'mega', 'small', 'thumbnail']
                  : ['mega', 'extralarge', 'large', 'small', 'thumbnail'];

        const baseUrls = [
            seedUrl,
            ...fieldOrder.map((field) => image?.[field])
        ].filter((url): url is string => typeof url === 'string' && url.trim().length > 0);

        const candidates: string[] = [];
        const add = (url: string) => {
            const trimmed = url.trim();
            if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
        };

        for (const url of baseUrls) {
            if (size === 'max') {
                add(this.replaceQobuzCoverSize(url, 'org'));
                add(this.replaceQobuzCoverSize(url, 'max'));
            } else if (size === 'large') {
                add(this.replaceQobuzCoverSize(url, '600'));
            } else if (size === 'small') {
                add(this.replaceQobuzCoverSize(url, '230'));
            }

            add(url);
        }

        return candidates;
    }

    private replaceQobuzCoverSize(url: string, size: string): string {
        return url.replace(/_(?:\d+|max|org)(\.[a-z0-9]+)(?:\?.*)?$/i, `_${size}$1`);
    }

    async extractMetadata(
        trackData: Track,
        albumData: Album,
        fileInfo: Record<string, unknown> = {}
    ): Promise<Metadata> {
        const album = (albumData && Object.keys(albumData).length > 0
            ? albumData
            : trackData.album || {}) as Album;
        const artist = (trackData.performer || trackData.artist || {}) as Artist;
        const composer = (trackData.composer || {}) as Artist;

        const performers = this.extractPerformers(trackData, albumData);
        const credits = this.extractCredits(albumData);

        const allArtistNames = new Set<string>();

        if (performers.main.length > 0) {
            performers.main.forEach((p: { name: string }) => allArtistNames.add(p.name));
        } else {
            const fallback = (trackData.performer?.name || trackData.artist?.name || 'Unknown') as string;
            allArtistNames.add(fallback);
        }

        if (performers.featured.length > 0) {
            performers.featured.forEach((f: string) => allArtistNames.add(f));
        }

        const names = Array.from(allArtistNames);
        const mainArtist = this.joinWithAnd(names);

        const composerName = this.joinWithAnd(
            performers.composers.length > 0
                ? performers.composers.map((p: { name: string }) => p.name)
                : [trackData.composer?.name || (composer as Artist).name].filter(Boolean) as string[]
        );

        const metadata: Metadata = {
            title: trackData.title || '',
            artist: mainArtist,
            album: album.title || '',
            year: album.released_at ? new Date(album.released_at * 1000).getFullYear() : '',
            trackNumber: trackData.track_number || 1,
            totalTracks: album.tracks_count || 1,
            discNumber: trackData.media_number || 1,
            totalDiscs: album.media_count || 1,
            genre: (() => {
                const list = album.genres_list || [];
                let bestGenre = '';

                if (list.length > 0) {
                    const lastItem = list[list.length - 1];
                    const name = typeof lastItem === 'string' ? lastItem : (lastItem as { name: string }).name;
                    bestGenre = name.split('→').pop()!.trim();
                } else if ((album.genre as { name?: string })?.name) {
                    bestGenre = (album.genre as { name: string }).name;
                }

                const GENRE_TRANSLATIONS: Record<string, string> = {
                    'Alternatif et Indé': 'Alternative & Indie',
                    Ambiance: 'Ambient',
                    'Bandes originales de films': 'Soundtrack',
                    'Chanson française': 'French Chanson',
                    Classique: 'Classical',
                    'Comédies musicales': 'Musicals',
                    'Dance/Électro': 'Dance & Electronic',
                    Électronique: 'Electronic',
                    'Hip-Hop/Rap': 'Hip-Hop & Rap',
                    Indé: 'Indie',
                    Jeunesse: 'Kids',
                    'Livres audio': 'Audiobooks',
                    'Livre audio': 'Audiobook',
                    'Musique africaine': 'African Music',
                    'Musique asiatique': 'Asian Music',
                    'Musique de film': 'Soundtrack',
                    'Musiques de films': 'Soundtracks',
                    'Musique du monde': 'World Music',
                    'Musique européenne (hors variété)': 'European Music',
                    'Musique latine': 'Latin Music',
                    'Musique religieuse': 'Religious Music',
                    'Musique de relaxation': 'Relaxation',
                    'Musiques électroniques': 'Electronic',
                    'Nouvel Âge': 'New Age',
                    Opéra: 'Opera',
                    'Reggae/Ska': 'Reggae & Ska',
                    'Religieux / Gospel': 'Religious & Gospel',
                    'Soul/Funk/R&B': 'R&B, Soul & Funk',
                    'Variété française': 'French Pop',
                    'Variétés internationales': 'International Pop',
                    'Musiques de Noël': 'Christmas Music',
                    'Musique de Noël': 'Christmas Music',
                    Noël: 'Christmas',
                    Blues: 'Blues',
                    Country: 'Country',
                    Jazz: 'Jazz',
                    Métal: 'Metal',
                    'Musique contemporaine': 'Contemporary Music',
                    'Musique expérimentale': 'Experimental',
                    Punk: 'Punk',
                    'R&B': 'R&B',
                    Rap: 'Rap',
                    Reggae: 'Reggae',
                    'Rock alternatif': 'Alternative Rock',
                    'Rock indépendant': 'Indie Rock',
                    Ska: 'Ska',
                    Soul: 'Soul',
                    'Spoken Word': 'Spoken Word',
                    Techno: 'Techno',
                    Trance: 'Trance',
                    'Trip-Hop': 'Trip-Hop',
                    'Alternative und Indie': 'Alternative & Indie',
                    'Elektronische Musik': 'Electronic',
                    Filmmusik: 'Film Music',
                    Filmsoundtracks: 'Soundtrack',
                    Hörbücher: 'Audiobooks',
                    Kinder: 'Kids',
                    Kinderlieder: "Children's Music",
                    Klassik: 'Classical',
                    Weltmusik: 'World Music',
                    Volksmusik: 'Folk Music',
                    Weihnachtsmusik: 'Christmas Music',
                    Weihnachten: 'Christmas',
                    Weihnachtslieder: 'Christmas Songs',
                    'Deutsche Musik': 'German Music',
                    Schlager: 'Schlager',
                    'Música alternativa': 'Alternative Music',
                    'Música clásica': 'Classical Music',
                    'Música electrónica': 'Electronic Music',
                    'Música latina': 'Latin Music',
                    'Música navideña': 'Christmas Music',
                    Navidad: 'Christmas',
                    'Bandas sonoras': 'Soundtracks',
                    'Musica classica': 'Classical Music',
                    'Musica elettronica': 'Electronic Music',
                    'Colonne sonore': 'Soundtracks',
                    'Musica natalizia': 'Christmas Music',
                    Natale: 'Christmas',
                    'Música clássica': 'Classical Music',
                    'Música eletrônica': 'Electronic Music',
                    'Trilhas sonoras': 'Soundtracks',
                    'Música de Natal': 'Christmas Music',
                    Natal: 'Christmas',
                    Ambience: 'Ambient',
                    Soundtracks: 'Soundtrack',
                    Alternative: 'Alternative',
                    'Hard Rock': 'Hard Rock',
                    'Heavy Metal': 'Heavy Metal',
                    Pop: 'Pop',
                    Rock: 'Rock',
                    'Christmas Music': 'Christmas Music',
                    Christmas: 'Christmas',
                    Holiday: 'Holiday',
                    'Holiday Music': 'Holiday Music'
                };

                const lowerGenre = bestGenre.toLowerCase().trim();
                const matchedKey = Object.keys(GENRE_TRANSLATIONS).find(
                    (k) => k.toLowerCase().trim() === lowerGenre
                );

                return matchedKey ? GENRE_TRANSLATIONS[matchedKey] : bestGenre;
            })(),

            albumArtist: (album.artist as { name?: string })?.name || artist.name || '',
            composer: composerName,
            conductor: performers.conductor || '',
            producer: (
                performers.producers.map((p: { name: string }) => p.name).join('; ') ||
                credits.producer ||
                ''
            ).trim(),
            mixer: (
                performers.mixers.map((p: { name: string }) => p.name).join('; ') ||
                credits.mixer ||
                ''
            ).trim(),
            remixer: credits.remixer || '',
            lyricist:
                credits.lyricist ||
                performers.writers
                    .filter(
                        (p: { role: string }) =>
                            p.role.toLowerCase().includes('lyricist') ||
                            p.role.toLowerCase().includes('author')
                    )
                    .map((p: { name: string }) => p.name)
                    .join('; ') ||
                composerName ||
                '',
            writer: (
                performers.writers.map((p: { name: string }) => p.name).join('; ') ||
                credits.writer ||
                composerName ||
                ''
            ).trim(),
            arranger: credits.arranger || '',
            engineer: (
                performers.engineers.map((p: { name: string }) => p.name).join('; ') ||
                credits.engineer ||
                ''
            ).trim(),

            label: (album.label as { name?: string })?.name || '',
            copyright: album.copyright || '',
            isrc: trackData.isrc || '',
            upc: album.upc || '',
            barcode: album.upc || '',
            catalogNumber: (album.catalog_number as string) || '',

            releaseDate: this.formatDate(album.released_at as number),
            originalReleaseDate: this.formatDate(album.released_at as number),
            releaseType: (album.release_type as string) || 'album',
            version: (trackData.version as string) || '',

            duration: trackData.duration || 0,
            durationFormatted: this.formatDuration(trackData.duration),
            bitDepth: (fileInfo.bitDepth as number) || trackData.maximum_bit_depth || 16,
            sampleRate: (fileInfo.sampleRate as number) || trackData.maximum_sampling_rate || 44.1,
            bitrate: (fileInfo.bitrate as number) || 0,
            channels: (fileInfo.channels as number) || 2,

            qobuzTrackId: trackData.id?.toString() || '',
            qobuzAlbumId: album.id?.toString() || '',
            qobuzArtistId: artist.id?.toString() || '',
            streamable: trackData.streamable || false,
            hiresStreamable: trackData.hires_streamable || trackData.hires || false,
            hiresAvailable: album.hires || trackData.hires || false,
            parental: trackData.parental_warning || false,

            coverUrl: this.selectCoverUrl(album.image, 'max'),

            description: album.description || '',
            comment: 'downloader by qbz-dl https://github.com/ifauzeee/QBZ-Downloader',
            encodedBy: '',

            performers: performers,
            credits: credits,
            allArtists: this.getAllArtists(trackData, albumData) as string[],

            rawTrack: trackData,
            rawAlbum: albumData
        };

        return metadata;
    }

    extractPerformers(trackData: Track, _albumData: Album) {
        const performers: {
            main: { name: string; role: string }[];
            featured: string[];
            conductor: string;
            orchestra: string;
            choir: string;
            ensemble: string;
            composers: { name: string; role: string }[];
            producers: { name: string; role: string }[];
            writers: { name: string; role: string }[];
            engineers: { name: string; role: string }[];
            mixers: { name: string; role: string }[];
        } = {
            main: [],
            featured: [],
            conductor: '',
            orchestra: '',
            choir: '',
            ensemble: '',
            composers: [],
            producers: [],
            writers: [],
            engineers: [],
            mixers: []
        };

        const addPerformer = (name: string, role: string, targetList: { name: string; role: string }[]) => {
            const normalized = this.normalizeName(name);
            const exists = targetList.some((p) => this.normalizeName(p.name) === normalized);
            if (!exists) {
                targetList.push({ name, role });
            }
        };

        if (trackData.performers && typeof trackData.performers === 'string') {
            const perfs = trackData.performers.split(' - ');
            for (const perf of perfs) {
                const parts = perf.split(', ');
                const name = parts[0];
                const role = parts.slice(1).join(', ');

                if (role && name) {
                    const roleLower = role.toLowerCase();

                    if (roleLower.includes('composer')) {
                        addPerformer(name, role, performers.composers);
                    }
                    if (roleLower.includes('producer')) {
                        addPerformer(name, role, performers.producers);
                    }
                    if (
                        roleLower.includes('writer') ||
                        roleLower.includes('lyricist') ||
                        roleLower.includes('author')
                    ) {
                        addPerformer(name, role, performers.writers);
                    }
                    if (
                        roleLower.includes('engineer') ||
                        roleLower.includes('mastering') ||
                        roleLower.includes('recording')
                    ) {
                        addPerformer(name, role, performers.engineers);
                    }
                    if (roleLower.includes('mixer')) {
                        addPerformer(name, role, performers.mixers);
                    }

                    if (roleLower.includes('conductor')) performers.conductor = name;
                    else if (roleLower.includes('orchestra')) performers.orchestra = name;
                    else if (roleLower.includes('choir')) performers.choir = name;

                    if (roleLower.includes('featured artist') || roleLower.includes('featuring')) {
                        const normalized = this.normalizeName(name);
                        const exists = performers.featured.some(
                            (n: string) => this.normalizeName(n) === normalized
                        );
                        if (!exists) {
                            performers.featured.push(name);
                        }
                    }

                    if (
                        roleLower.includes('main artist') ||
                        roleLower.includes('mainartist') ||
                        roleLower === 'performer'
                    ) {
                        addPerformer(name, role, performers.main);
                    }
                }
            }
        }

        return performers;
    }

    extractCredits(albumData: Album) {
        const credits: Record<string, string> = {
            producer: '',
            mixer: '',
            remixer: '',
            lyricist: '',
            writer: '',
            arranger: '',
            engineer: '',
            masteredBy: '',
            recordedBy: ''
        };

        if (albumData?.credits && Array.isArray(albumData.credits)) {
            const creditMap: Record<string, string> = {
                Producer: 'producer',
                Mixer: 'mixer',
                'Mixed By': 'mixer',
                Remixer: 'remixer',
                Lyricist: 'lyricist',
                Songwriter: 'writer',
                Writer: 'writer',
                Arranger: 'arranger',
                Engineer: 'engineer',
                Mastering: 'masteredBy',
                Recording: 'recordedBy'
            };

            for (const credit of albumData.credits as { role?: string; name?: string }[]) {
                for (const [key, field] of Object.entries(creditMap)) {
                    if (credit.role?.includes(key)) {
                        const existing = credits[field];
                        credits[field] = existing
                            ? `${existing}; ${credit.name}`
                            : credit.name || '';
                    }
                }
            }
        }

        return credits;
    }

    getAllArtists(trackData: Track, albumData: Album) {
        const artists = new Set();

        if ((trackData.performer as { name?: string })?.name) artists.add((trackData.performer as { name: string }).name);
        if ((trackData.artist as { name?: string })?.name) artists.add((trackData.artist as { name: string }).name);
        if ((trackData.composer as { name?: string })?.name) artists.add((trackData.composer as { name: string }).name);
        if ((albumData?.artist as { name?: string })?.name) artists.add((albumData.artist as { name: string }).name);

        return Array.from(artists);
    }

    formatDate(timestamp?: number) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toISOString().split('T')[0];
    }

    formatDuration(seconds?: number) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatDurationLong(seconds?: number) {
        if (!seconds) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    buildId3Tags(metadata: Metadata, coverBuffer: Buffer | null = null, lyrics: LyricsResult | null = null) {
        const tags: NodeID3.Tags = {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year?.toString() || '',
            trackNumber: `${metadata.trackNumber}/${metadata.totalTracks}`,
            partOfSet: `${metadata.discNumber}/${metadata.totalDiscs}`,
            genre: metadata.genre,

            composer: metadata.composer,
            conductor: metadata.conductor,
            publisher: metadata.label,
            copyright: metadata.copyright,
            encodedBy: metadata.encodedBy,

            ISRC: metadata.isrc,
            originalReleaseTime: metadata.originalReleaseDate,
            comment: {
                language: 'eng',
                text: metadata.comment
            },

            userDefinedText: [
                { description: 'BARCODE', value: String(metadata.upc || '') },
                { description: 'CATALOGNUMBER', value: String(metadata.catalogNumber || '') },
                { description: 'LABEL', value: String(metadata.label || '') },
                { description: 'RELEASETYPE', value: String(metadata.releaseType || '') }
            ].filter((t) => t.value)
        };

        if (metadata.albumArtist) {
            tags.performerInfo = metadata.albumArtist;
        }

        if (coverBuffer) {
            tags.image = {
                mime: 'image/jpeg',
                type: { id: 3, name: 'front cover' },
                description: 'Cover',
                imageBuffer: coverBuffer
            };
        }

        if (lyrics) {
            const synced = lyrics.syncedLyrics;
            const plain = lyrics.plainLyrics || lyrics.syncedLyrics;
            
            // Priority for unsynchronisedLyrics: synced (LRC format) then plain
            // Many modern players (BlackPlayer, Musicolet, etc.) look for LRC in USLT
            const mainLyrics = synced || plain;

            if (mainLyrics) {
                tags.unsynchronisedLyrics = {
                    language: 'eng',
                    text: typeof mainLyrics === 'string' ? mainLyrics : ''
                };
            }

            if (lyrics.syltFormat && Array.isArray(lyrics.syltFormat)) {
                tags.synchronisedLyrics = [
                    {
                        language: 'eng',
                        timeStampFormat: 2,
                        contentType: 1,
                        shortText: 'Lyrics',
                        synchronisedText: (lyrics.syltFormat as { text: string; time: number }[]).map((l: { text: string; time: number }) => ({
                            text: l.text,
                            timeStamp: l.time
                        }))
                    }
                ];
            }
        }

        return tags;
    }

    buildFlacTags(metadata: Metadata, lyrics: LyricsResult | null = null) {
        const comments = [
            ['TITLE', metadata.title],
            ['ARTIST', metadata.artist],
            ['ALBUM', metadata.album],
            ['DATE', metadata.releaseDate],
            ['YEAR', metadata.year?.toString()],
            ['TRACKNUMBER', metadata.trackNumber?.toString()],
            ['TRACKTOTAL', metadata.totalTracks?.toString()],
            ['DISCNUMBER', metadata.discNumber?.toString()],
            ['DISCTOTAL', metadata.totalDiscs?.toString()],
            ['GENRE', metadata.genre],

            ['ALBUMARTIST', metadata.albumArtist],
            ['COMPOSER', metadata.composer],
            ['CONDUCTOR', metadata.conductor],
            ['PRODUCER', metadata.producer],
            ['MIXER', metadata.mixer],
            ['ARRANGER', metadata.arranger],
            ['ENGINEER', metadata.engineer],
            ['LYRICIST', metadata.lyricist],
            ['WRITER', metadata.writer],

            ['LABEL', metadata.label],
            ['PUBLISHER', metadata.label],
            ['COPYRIGHT', metadata.copyright],
            ['ISRC', metadata.isrc],
            ['BARCODE', metadata.upc],
            ['UPC', metadata.upc],
            ['CATALOGNUMBER', metadata.catalogNumber],

            ['ORIGINALDATE', metadata.originalReleaseDate],
            ['RELEASEDATE', metadata.releaseDate],
            ['RELEASETYPE', metadata.releaseType],
            ['MEDIA', 'Digital Media'],
            ['VERSION', metadata.version],

            ['ENCODER', metadata.encodedBy],
            ['COMMENT', metadata.comment]
        ];

        if (lyrics) {
            const synced = lyrics.syncedLyrics;
            const plain = lyrics.plainLyrics || lyrics.syncedLyrics;

            if (synced) {
                const syncedStr = typeof synced === 'string' ? synced : '';
                comments.push(['SYNCEDLYRICS', syncedStr]);
                // Many players expect LRC format in the LYRICS tag for synced display
                comments.push(['LYRICS', syncedStr]);
            }

            if (plain) {
                const plainStr = typeof plain === 'string' ? plain : '';
                comments.push(['UNSYNCEDLYRICS', plainStr]);
                comments.push(['UNSYNCED LYRICS', plainStr]);
                // If no synced lyrics, use plain for the main tag
                if (!synced) {
                    comments.push(['LYRICS', plainStr]);
                }
            }

            if (lyrics.source) {
                comments.push(['LYRICS_SOURCE', lyrics.source]);
            }
        }

        const validComments = comments.filter(([_key, value]) => {
            if (value === undefined || value === null) return false;
            const str = value.toString();
            return str.trim().length > 0;
        });

        const expandedComments: string[][] = [];
        for (const [key, value] of validComments) {
            if (typeof value === 'string' && value.includes('; ')) {
                const parts = value.split('; ');
                parts.forEach((p) => expandedComments.push([key, p]));
            } else {
                expandedComments.push([key, value?.toString() || '']);
            }
        }

        return expandedComments;
    }

    async writeId3Tags(filePath: string, tags: NodeID3.Tags) {
        return new Promise((resolve, reject) => {
            const success = NodeID3.write(tags, filePath);
            if (success) {
                resolve({ success: true });
            } else {
                reject(new Error('Failed to write ID3 tags'));
            }
        });
    }

    getMetadataDisplay(metadata: Metadata) {
        return {
            '📀 Title': metadata.title,
            '🎤 Artist': metadata.artist,
            '💿 Album': metadata.album,
            '📅 Year': metadata.year,
            '🔢 Track': `${metadata.trackNumber}/${metadata.totalTracks}`,
            '💽 Disc': `${metadata.discNumber}/${metadata.totalDiscs}`,
            '🎵 Genre': metadata.genre,
            '🏷️ Label': metadata.label,
            '©️ Copyright': metadata.copyright,
            '🔗 ISRC': metadata.isrc,
            '📊 Quality': `${metadata.bitDepth}bit/${metadata.sampleRate}kHz`,
            '⏱️ Duration': metadata.durationFormatted,
            '✨ Hi-Res': metadata.hiresAvailable ? '✅' : '❌'
        };
    }
    async writeFlacTags(filePath: string, tags: string[][], coverBuffer: Buffer | null = null) {
        return new Promise<void>((resolve, reject) => {
            const tempPath = filePath + '.tmp';
            let readStream: fs.ReadStream;
            let writeStream: fs.WriteStream;

            try {
                readStream = fs.createReadStream(filePath);
                writeStream = fs.createWriteStream(tempPath);
            } catch (e) {
                return reject(e);
            }

            const processor = new flac.Processor({ parseMetaDataBlocks: true });
            const comments = tags.map(([key, val]) => `${key}=${val}`);
            const vendor = 'QBZ-Downloader v5.1.0';

            let metadataInserted = false;

            processor.on('preprocess', (mdb: { type: number; remove: () => void; isLast: boolean }) => {
                if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
                    mdb.remove();
                    return;
                }

                if (mdb.type === flac.Processor.MDB_TYPE_PICTURE && coverBuffer) {
                    mdb.remove();
                    return;
                }

                if (mdb.type === flac.Processor.MDB_TYPE_STREAMINFO && !metadataInserted) {
                    metadataInserted = true;

                    mdb.isLast = false;
                }
            });

            processor.on('postprocess', (mdb: { type: number }) => {
                if (mdb.type === flac.Processor.MDB_TYPE_STREAMINFO) {
                    const isVorbisLast = !coverBuffer;
                    const mdbVorbis = flac.data.MetaDataBlockVorbisComment.create(
                        isVorbisLast,
                        vendor,
                        comments
                    );
                    processor.push(mdbVorbis.publish());

                    if (coverBuffer) {
                        try {
                            const mdbPicture = flac.data.MetaDataBlockPicture.create(
                                true,
                                3,
                                'image/jpeg',
                                'Cover',
                                0,
                                0,
                                0,
                                0,
                                coverBuffer
                            );
                            processor.push(mdbPicture.publish());
                        } catch {}
                    }
                }
            });

            readStream.pipe(processor).pipe(writeStream);

            writeStream.on('finish', () => {
                try {
                    const stats = fs.statSync(tempPath);
                    if (stats.size > 1000) {
                        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                        fs.renameSync(tempPath, filePath);
                        resolve();
                    } else {
                        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                        reject(new Error('Tagging resulted in invalid file size'));
                    }
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : String(err);
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    reject(new Error(message));
                }
            });

            writeStream.on('error', (err: Error) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
            processor.on('error', (err: Error) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
            readStream.on('error', (err: Error) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
        });
    }

    private static taggingLock: Promise<void> = Promise.resolve();

    async writeMetadata(
        filePath: string,
        metadata: Metadata,
        _quality: number,
        lyrics: LyricsResult | null = null,
        coverBuffer: Buffer | null = null
    ) {
        const operation = async () => {
            try {
                logger.debug(`Writing metadata to ${path.basename(filePath)} (Lyrics: ${lyrics ? 'Yes' : 'No'})`, 'META');
                if (filePath.endsWith('.flac')) {
                    const tags = this.buildFlacTags(metadata, lyrics);
                    await this.writeFlacTags(filePath, tags, coverBuffer);
                } else if (filePath.endsWith('.mp3')) {
                    const tags = this.buildId3Tags(metadata, coverBuffer, lyrics);
                    await this.writeId3Tags(filePath, tags);
                }
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                console.error(`[TAG] Failed to tag ${filePath}: ${message}`);
                throw error;
            }
        };

        MetadataService.taggingLock = MetadataService.taggingLock.then(() =>
            operation().catch(() => {})
        );

        return MetadataService.taggingLock;
    }
}

export default MetadataService;
