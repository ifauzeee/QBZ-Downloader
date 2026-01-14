import NodeID3 from 'node-id3';

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

    async extractMetadata(
        trackData: RawData,
        albumData: RawData,
        fileInfo: RawData = {}
    ): Promise<Metadata> {
        const album = trackData.album || albumData || {};
        const artist = trackData.performer || trackData.artist || {};
        const composer = trackData.composer || {};

        const performers = this.extractPerformers(trackData, albumData);
        const credits = this.extractCredits(albumData);

        let mainArtist = '';
        if (performers.main.length > 0) {
            mainArtist = performers.main.map((p: any) => p.name).join('; ');
        } else {
            mainArtist = artist.name || trackData.performer?.name || 'Unknown';
        }

        if (performers.featured.length > 0) {
            const featuredStr = performers.featured.join('; ');
            if (mainArtist) mainArtist += '; ' + featuredStr;
            else mainArtist = featuredStr;
        }

        const metadata: Metadata = {
            title: trackData.title || '',
            artist: mainArtist,
            album: album.title || '',
            year: album.released_at ? new Date(album.released_at * 1000).getFullYear() : '',
            trackNumber: trackData.track_number || 1,
            totalTracks: album.tracks_count || 1,
            discNumber: trackData.media_number || 1,
            totalDiscs: album.media_count || 1,
            genre: album.genre?.name || album.genres_list?.[0] || '',

            albumArtist: album.artist?.name || artist.name || '',
            composer: (
                performers.composers.map((p: any) => p.name).join('; ') ||
                trackData.composer?.name ||
                composer.name ||
                ''
            ).trim(),
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

            coverUrl: album.image?.large || album.image?.small || '',

            description: album.description || '',
            comment: '',
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
        const performers: any = {
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

        const seenNames = new Set();

        const addPerformer = (name: string, role: string, targetList: any[]) => {
            const normalized = this.normalizeName(name);
            if (!seenNames.has(normalized)) {
                targetList.push({ name, role });
                seenNames.add(normalized);
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
                    } else if (roleLower.includes('producer')) {
                        addPerformer(name, role, performers.producers);
                    } else if (
                        roleLower.includes('writer') ||
                        roleLower.includes('lyricist') ||
                        roleLower.includes('author')
                    ) {
                        addPerformer(name, role, performers.writers);
                    } else if (
                        roleLower.includes('engineer') ||
                        roleLower.includes('mastering') ||
                        roleLower.includes('recording')
                    ) {
                        addPerformer(name, role, performers.engineers);
                    } else if (roleLower.includes('mixer')) {
                        addPerformer(name, role, performers.mixers);
                    }

                    if (roleLower.includes('conductor')) performers.conductor = name;
                    else if (roleLower.includes('orchestra')) performers.orchestra = name;
                    else if (roleLower.includes('choir')) performers.choir = name;
                    else if (
                        roleLower.includes('featured artist') ||
                        roleLower.includes('featuring')
                    ) {
                        const normalized = this.normalizeName(name);
                        if (!seenNames.has(normalized)) {
                            performers.featured.push(name);
                            seenNames.add(normalized);
                        }
                    } else if (roleLower.includes('main artist')) {
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
            ['DATE', metadata.year?.toString()],
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
                comments.push(['LYRICS_SYNCED', lyrics.syncedLyrics]);
                comments.push(['LYRICS', lyrics.syncedLyrics]);
                comments.push(['UNSYNCEDLYRICS', lyrics.syncedLyrics]);
            }

            if (lyrics.source) {
                comments.push(['LYRICS_SOURCE', lyrics.source]);
            }
        }

        return comments.filter(([_key, value]) => value && value.toString().trim());
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
}

export default MetadataService;
