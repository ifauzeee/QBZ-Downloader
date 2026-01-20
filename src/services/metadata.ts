import NodeID3 from 'node-id3';
import flac from 'flac-metadata';
import fs from 'fs';

export type RawData = Record<string, any>;

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
    allArtists: any[];

    rawTrack: RawData;
    rawAlbum: RawData;

    replayGain?: string;
}
class MetadataService {
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

    async extractMetadata(
        trackData: RawData,
        albumData: RawData,
        fileInfo: RawData = {}
    ): Promise<Metadata> {
        const album =
            albumData && Object.keys(albumData).length > 0 ? albumData : trackData.album || {};
        const artist = trackData.performer || trackData.artist || {};
        const composer = trackData.composer || {};

        const performers = this.extractPerformers(trackData, albumData);
        const credits = this.extractCredits(albumData);

        const allArtistNames = new Set<string>();

        if (performers.main.length > 0) {
            performers.main.forEach((p: any) => allArtistNames.add(p.name));
        } else {
            const fallback = artist.name || trackData.performer?.name || 'Unknown';
            allArtistNames.add(fallback);
        }

        if (performers.featured.length > 0) {
            performers.featured.forEach((f: string) => allArtistNames.add(f));
        }

        const names = Array.from(allArtistNames);
        const mainArtist = this.joinWithAnd(names);

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
                    const name = typeof lastItem === 'string' ? lastItem : lastItem.name;
                    bestGenre = name.split('→').pop()!.trim();
                } else if (album.genre?.name) {
                    bestGenre = album.genre.name;
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

            albumArtist: album.artist?.name || artist.name || '',
            composer: this.joinWithAnd(
                performers.composers.length > 0
                    ? performers.composers.map((p: any) => p.name)
                    : [trackData.composer?.name || composer.name].filter(Boolean)
            ),
            conductor: performers.conductor || '',
            producer: (
                performers.producers.map((p: any) => p.name).join('; ') ||
                credits.producer ||
                ''
            ).trim(),
            mixer: (
                performers.mixers.map((p: any) => p.name).join('; ') ||
                credits.mixer ||
                ''
            ).trim(),
            remixer: credits.remixer || '',
            lyricist: credits.lyricist || '',
            writer: (
                performers.writers.map((p: any) => p.name).join('; ') ||
                credits.writer ||
                ''
            ).trim(),
            arranger: credits.arranger || '',
            engineer: (
                performers.engineers.map((p: any) => p.name).join('; ') ||
                credits.engineer ||
                ''
            ).trim(),

            label: album.label?.name || '',
            copyright: album.copyright || '',
            isrc: trackData.isrc || '',
            upc: album.upc || '',
            barcode: album.upc || '',
            catalogNumber: album.catalog_number || '',

            releaseDate: this.formatDate(album.released_at),
            originalReleaseDate: this.formatDate(album.released_at),
            releaseType: album.release_type || 'album',
            version: trackData.version || '',

            duration: trackData.duration || 0,
            durationFormatted: this.formatDuration(trackData.duration),
            bitDepth: fileInfo.bitDepth || trackData.maximum_bit_depth || 16,
            sampleRate: fileInfo.sampleRate || trackData.maximum_sampling_rate || 44.1,
            bitrate: fileInfo.bitrate || 0,
            channels: fileInfo.channels || 2,

            qobuzTrackId: trackData.id?.toString() || '',
            qobuzAlbumId: album.id?.toString() || '',
            qobuzArtistId: artist.id?.toString() || '',
            streamable: trackData.streamable || false,
            hiresStreamable: trackData.hires_streamable || trackData.hires || false,
            hiresAvailable: album.hires || trackData.hires || false,
            parental: trackData.parental_warning || false,

            coverUrl:
                album.image?.mega ||
                album.image?.extralarge ||
                album.image?.large ||
                album.image?.small ||
                '',

            description: album.description || '',
            comment: 'downloader by qbz-dl https://github.com/ifauzeee/QBZ-Downloader',
            encodedBy: '',

            performers: performers,
            credits: credits,
            allArtists: this.getAllArtists(trackData, albumData),

            rawTrack: trackData,
            rawAlbum: albumData
        };

        return metadata;
    }

    extractPerformers(trackData: RawData, _albumData: RawData) {
        const performers: {
            main: any[];
            featured: string[];
            conductor: string;
            orchestra: string;
            choir: string;
            ensemble: string;
            composers: any[];
            producers: any[];
            writers: any[];
            engineers: any[];
            mixers: any[];
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

        const addPerformer = (name: string, role: string, targetList: any[]) => {
            const normalized = this.normalizeName(name);
            const exists = targetList.some((p: any) => this.normalizeName(p.name) === normalized);
            if (!exists) {
                targetList.push({ name, role });
            }
        };

        if (trackData.performers) {
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

    extractCredits(albumData: RawData) {
        const credits: any = {
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

        if (albumData?.credits) {
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

            for (const credit of albumData.credits) {
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

    getAllArtists(trackData: RawData, albumData: RawData) {
        const artists = new Set();

        if (trackData.performer?.name) artists.add(trackData.performer.name);
        if (trackData.artist?.name) artists.add(trackData.artist.name);
        if (trackData.composer?.name) artists.add(trackData.composer.name);
        if (albumData?.artist?.name) artists.add(albumData.artist.name);

        return Array.from(artists);
    }

    formatDate(timestamp: number) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toISOString().split('T')[0];
    }

    formatDuration(seconds: number) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatDurationLong(seconds: number) {
        if (!seconds) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    buildId3Tags(metadata: Metadata, coverBuffer: Buffer | null = null, lyrics: any = null) {
        const tags: any = {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            year: metadata.year?.toString(),
            trackNumber: `${metadata.trackNumber}/${metadata.totalTracks}`,
            partOfSet: `${metadata.discNumber}/${metadata.totalDiscs}`,
            genre: metadata.genre,

            composer: metadata.composer,
            conductor: metadata.conductor,
            publisher: metadata.label,
            copyright: metadata.copyright,
            encodedBy: metadata.encodedBy,

            ISRC: metadata.isrc,
            originalReleaseDate: metadata.originalReleaseDate,
            comment: {
                language: 'eng',
                text: metadata.comment
            },

            userDefinedText: [
                { description: 'BARCODE', value: metadata.upc },
                { description: 'CATALOGNUMBER', value: metadata.catalogNumber },
                { description: 'LABEL', value: metadata.label },
                { description: 'RELEASETYPE', value: metadata.releaseType }
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
            if (lyrics.syncedLyrics) {
                tags.unsynchronisedLyrics = {
                    language: 'eng',
                    text: lyrics.syncedLyrics
                };
            } else if (lyrics.plainLyrics) {
                tags.unsynchronisedLyrics = {
                    language: 'eng',
                    text: lyrics.plainLyrics
                };
            }

            if (lyrics.syltFormat) {
                tags.synchronisedLyrics = lyrics.syltFormat.map((l: any) => ({
                    text: l.text,
                    timeStamp: l.timeStamp
                }));
            }
        }

        return tags;
    }

    buildFlacTags(metadata: Metadata, lyrics: any = null) {
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
            if (lyrics.syncedLyrics) {
                comments.push(['SYNCEDLYRICS', lyrics.syncedLyrics]);
                comments.push(['LYRICS', lyrics.syncedLyrics]);
            } else if (lyrics.plainLyrics) {
                comments.push(['LYRICS', lyrics.plainLyrics]);
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

    async writeId3Tags(filePath: string, tags: any) {
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
            const vendor = 'QBZ-Downloader v3.0.0';

            let metadataInserted = false;

            processor.on('preprocess', (mdb: any) => {
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

            processor.on('postprocess', (mdb: any) => {
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
                } catch (err: any) {
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                    reject(err);
                }
            });

            writeStream.on('error', (err: any) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
            processor.on('error', (err: any) => {
                if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                reject(err);
            });
            readStream.on('error', (err: any) => {
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
        lyrics: any = null,
        coverBuffer: Buffer | null = null
    ) {
        const operation = async () => {
            try {
                if (filePath.endsWith('.flac')) {
                    const tags = this.buildFlacTags(metadata, lyrics);
                    await this.writeFlacTags(filePath, tags, coverBuffer);
                } else if (filePath.endsWith('.mp3')) {
                    const tags = this.buildId3Tags(metadata, coverBuffer, lyrics);
                    await this.writeId3Tags(filePath, tags);
                }
            } catch (error: any) {
                console.error(`[TAG] Failed to tag ${filePath}: ${error.message}`);
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
