/**
 * METADATA SERVICE
 * Handles complete metadata extraction and embedding
 * Sources: Qobuz, Spotify, iTunes/Apple Music, MusicBrainz
 */

import fs from 'fs';
import path from 'path';
import NodeID3 from 'node-id3';
import { CONFIG } from '../config.js';
import SpotifyAPI from '../api/spotify.js';
import iTunesAPI from '../api/itunes.js';
import MusicBrainzAPI from '../api/musicbrainz.js';

class MetadataService {
    constructor() {
        this.supportedFormats = ['flac', 'mp3', 'm4a'];
        this.spotifyApi = new SpotifyAPI();
        this.itunesApi = new iTunesAPI();
        this.musicBrainzApi = MusicBrainzAPI;
    }

    /**
     * Get enhanced metadata from multiple sources (Spotify, iTunes, MusicBrainz)
     */
    async getEnhancedMetadata(title, artist, album = '', isrc = null) {
        const enhanced = {
            spotify: null,
            itunes: null,
            musicBrainz: null,
            merged: {}
        };

        try {

            const [spotifyResult, itunesResult, mbResult] = await Promise.all([
                this.spotifyApi.getEnhancedMetadata(title, artist, album).catch(e => ({ success: false })),
                this.itunesApi.getEnhancedMetadata(title, artist, album).catch(e => ({ success: false })),
                this.musicBrainzApi.getMetadata(title, artist, album, isrc).catch(e => null)
            ]);

            if (spotifyResult.success) {
                enhanced.spotify = spotifyResult.data;
            }

            if (itunesResult.success) {
                enhanced.itunes = itunesResult.data;
            }

            if (mbResult) {
                enhanced.musicBrainz = mbResult;
            }

            enhanced.merged = this.mergeMetadataSources(enhanced);

        } catch (error) {
            console.error('Enhanced metadata fetch error:', error.message);
        }

        return enhanced;
    }

    /**
     * Merge metadata from multiple sources
     */
    mergeMetadataSources(enhanced) {
        const merged = {};

        if (enhanced.musicBrainz) {
            if (enhanced.musicBrainz.originalReleaseDate) {
                merged.originalReleaseDate = enhanced.musicBrainz.originalReleaseDate;
            }
            if (enhanced.musicBrainz.musicBrainzId) {
                merged.musicBrainzId = enhanced.musicBrainz.musicBrainzId;
            }
            if (enhanced.musicBrainz.genres && enhanced.musicBrainz.genres.length > 0) {
                merged.mbGenres = enhanced.musicBrainz.genres;
            }
        }

        if (enhanced.spotify) {
            merged.bpm = enhanced.spotify.spotifyBpm || 0;
            merged.key = enhanced.spotify.spotifyKey || '';
            merged.mode = enhanced.spotify.spotifyMode || '';
            merged.timeSignature = enhanced.spotify.spotifyTimeSignature || 4;
            merged.danceability = enhanced.spotify.spotifyDanceability || 0;
            merged.energy = enhanced.spotify.spotifyEnergy || 0;
            merged.valence = enhanced.spotify.spotifyValence || 0;
            merged.acousticness = enhanced.spotify.spotifyAcousticness || 0;
            merged.instrumentalness = enhanced.spotify.spotifyInstrumentalness || 0;
            merged.liveness = enhanced.spotify.spotifyLiveness || 0;
            merged.speechiness = enhanced.spotify.spotifySpeechiness || 0;
            merged.loudness = enhanced.spotify.spotifyLoudness || 0;
            merged.popularity = enhanced.spotify.spotifyPopularity || 0;
            merged.genres = enhanced.spotify.spotifyGenres || merged.mbGenres || '';
            merged.spotifyId = enhanced.spotify.spotifyTrackId || '';
            merged.spotifyUri = enhanced.spotify.spotifyUri || '';
            merged.isrcSpotify = enhanced.spotify.spotifyIsrc || '';
        }

        if (enhanced.itunes) {
            merged.itunesId = enhanced.itunes.itunesTrackId || '';
            merged.itunesCoverUrl = enhanced.itunes.itunesCoverUrl || '';
            merged.itunesCopyright = enhanced.itunes.itunesCopyright || '';
            merged.itunesGenre = enhanced.itunes.itunesGenre || '';
            merged.appleMusicUrl = enhanced.itunes.itunesTrackViewUrl || '';
            merged.isrcItunes = enhanced.itunes.itunesIsrc || '';
        }

        merged.bestCoverUrl = enhanced.itunes?.itunesCoverUrl ||
            enhanced.spotify?.spotifyCoverUrl || '';

        return merged;
    }

    /**
     * Extract complete metadata from Qobuz track/album data
     */
    extractMetadata(trackData, albumData, fileInfo = {}) {
        const album = trackData.album || albumData || {};
        const artist = trackData.performer || trackData.artist || {};
        const composer = trackData.composer || {};


        const performers = this.extractPerformers(trackData, albumData);
        const credits = this.extractCredits(albumData);

        const metadata = {
            title: trackData.title || '',
            artist: artist.name || trackData.performer?.name || '',
            album: album.title || '',
            year: album.released_at ? new Date(album.released_at * 1000).getFullYear() : '',
            trackNumber: trackData.track_number || 1,
            totalTracks: album.tracks_count || 1,
            discNumber: trackData.media_number || 1,
            totalDiscs: album.media_count || 1,
            genre: album.genre?.name || album.genres_list?.[0] || '',

            albumArtist: album.artist?.name || artist.name || '',
            composer: composer.name || trackData.composer?.name || '',
            conductor: performers.conductor || '',
            producer: credits.producer || '',
            mixer: credits.mixer || '',
            remixer: credits.remixer || '',
            lyricist: credits.lyricist || '',
            writer: credits.writer || '',
            arranger: credits.arranger || '',
            engineer: credits.engineer || '',

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
            coverUrlSmall: album.image?.small || '',
            coverUrlLarge: album.image?.large || '',
            coverUrlMax: album.image?.large?.replace('600', '1200') || '',

            description: album.description || '',
            comment: `Downloaded from Qobuz | ${fileInfo.bitDepth || 16}bit/${fileInfo.sampleRate || 44.1}kHz`,
            encodedBy: 'Qobuz-DL CLI v2.0',

            performers: performers,
            credits: credits,
            allArtists: this.getAllArtists(trackData, albumData),

            rawTrack: trackData,
            rawAlbum: albumData
        };

        return metadata;
    }

    /**
     * Get enhanced metadata from multiple sources (Spotify, iTunes, MusicBrainz)
     */
    async getEnhancedMetadata(title, artist, album = '') {
        const enhanced = {
            spotify: null,
            itunes: null,
            merged: {}
        };

        try {

            const [spotifyResult, itunesResult] = await Promise.all([
                this.spotifyApi.getEnhancedMetadata(title, artist, album).catch(e => ({ success: false })),
                this.itunesApi.getEnhancedMetadata(title, artist, album).catch(e => ({ success: false }))
            ]);

            if (spotifyResult.success) {
                enhanced.spotify = spotifyResult.data;
            }

            if (itunesResult.success) {
                enhanced.itunes = itunesResult.data;
            }


            enhanced.merged = this.mergeMetadataSources(enhanced);

        } catch (error) {
            console.error('Enhanced metadata fetch error:', error.message);
        }

        return enhanced;
    }

    /**
     * Merge metadata from multiple sources
     */
    mergeMetadataSources(enhanced) {
        const merged = {};


        if (enhanced.spotify) {
            merged.bpm = enhanced.spotify.spotifyBpm || 0;
            merged.key = enhanced.spotify.spotifyKey || '';
            merged.mode = enhanced.spotify.spotifyMode || '';
            merged.timeSignature = enhanced.spotify.spotifyTimeSignature || 4;
            merged.danceability = enhanced.spotify.spotifyDanceability || 0;
            merged.energy = enhanced.spotify.spotifyEnergy || 0;
            merged.valence = enhanced.spotify.spotifyValence || 0;
            merged.acousticness = enhanced.spotify.spotifyAcousticness || 0;
            merged.instrumentalness = enhanced.spotify.spotifyInstrumentalness || 0;
            merged.liveness = enhanced.spotify.spotifyLiveness || 0;
            merged.speechiness = enhanced.spotify.spotifySpeechiness || 0;
            merged.loudness = enhanced.spotify.spotifyLoudness || 0;
            merged.popularity = enhanced.spotify.spotifyPopularity || 0;
            merged.genres = enhanced.spotify.spotifyGenres || '';
            merged.spotifyId = enhanced.spotify.spotifyTrackId || '';
            merged.spotifyUri = enhanced.spotify.spotifyUri || '';
            merged.isrcSpotify = enhanced.spotify.spotifyIsrc || '';
        }


        if (enhanced.itunes) {
            merged.itunesId = enhanced.itunes.itunesTrackId || '';
            merged.itunesCoverUrl = enhanced.itunes.itunesCoverUrl || '';
            merged.itunesCopyright = enhanced.itunes.itunesCopyright || '';
            merged.itunesGenre = enhanced.itunes.itunesGenre || '';
            merged.appleMusicUrl = enhanced.itunes.itunesTrackViewUrl || '';
            merged.isrcItunes = enhanced.itunes.itunesIsrc || '';
        }


        merged.bestCoverUrl = enhanced.itunes?.itunesCoverUrl ||
            enhanced.spotify?.spotifyCoverUrl || '';

        return merged;
    }

    /**
     * Extract all performers from track/album
     */
    extractPerformers(trackData, albumData) {
        const performers = {
            main: [],
            featured: [],
            conductor: '',
            orchestra: '',
            choir: '',
            ensemble: ''
        };


        if (trackData.performers) {
            const perfs = trackData.performers.split(' - ');
            for (const perf of perfs) {
                const [name, role] = perf.split(', ');
                if (role) {
                    const roleLower = role.toLowerCase();
                    if (roleLower.includes('conductor')) performers.conductor = name;
                    else if (roleLower.includes('orchestra')) performers.orchestra = name;
                    else if (roleLower.includes('choir')) performers.choir = name;
                    else if (roleLower.includes('featured')) performers.featured.push(name);
                    else performers.main.push({ name, role });
                }
            }
        }

        return performers;
    }

    /**
     * Extract credits from album data
     */
    extractCredits(albumData) {
        const credits = {
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
            const creditMap = {
                'Producer': 'producer',
                'Mixer': 'mixer',
                'Mixed By': 'mixer',
                'Remixer': 'remixer',
                'Lyricist': 'lyricist',
                'Songwriter': 'writer',
                'Writer': 'writer',
                'Arranger': 'arranger',
                'Engineer': 'engineer',
                'Mastering': 'masteredBy',
                'Recording': 'recordedBy'
            };

            for (const credit of albumData.credits) {
                for (const [key, field] of Object.entries(creditMap)) {
                    if (credit.role?.includes(key)) {
                        credits[field] = credit.name || '';
                    }
                }
            }
        }

        return credits;
    }

    /**
     * Get all artists combined
     */
    getAllArtists(trackData, albumData) {
        const artists = new Set();

        if (trackData.performer?.name) artists.add(trackData.performer.name);
        if (trackData.artist?.name) artists.add(trackData.artist.name);
        if (trackData.composer?.name) artists.add(trackData.composer.name);
        if (albumData?.artist?.name) artists.add(albumData.artist.name);

        return Array.from(artists);
    }

    /**
     * Format Unix timestamp to date string
     */
    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toISOString().split('T')[0];
    }

    /**
     * Format duration in seconds to MM:SS
     */
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Format duration in seconds to HH:MM:SS
     */
    formatDurationLong(seconds) {
        if (!seconds) return '00:00:00';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Build ID3v2.4 tags for MP3
     */
    buildId3Tags(metadata, coverBuffer = null, lyrics = null) {
        const tags = {
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
                { description: 'RELEASETYPE', value: metadata.releaseType },
                { description: 'QOBUZ_TRACK_ID', value: metadata.qobuzTrackId },
                { description: 'QOBUZ_ALBUM_ID', value: metadata.qobuzAlbumId },
                { description: 'AUDIO_QUALITY', value: `${metadata.bitDepth}bit/${metadata.sampleRate}kHz` }
            ].filter(t => t.value)
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

            if (lyrics.plainLyrics) {
                tags.unsynchronisedLyrics = {
                    language: 'eng',
                    text: lyrics.plainLyrics
                };
            }


            if (lyrics.syltFormat) {
                tags.synchronisedLyrics = lyrics.syltFormat.map(l => ({
                    text: l.text,
                    timeStamp: l.timeStamp
                }));
            }
        }

        return tags;
    }

    /**
     * Build Vorbis comments for FLAC with enhanced metadata
     */
    buildFlacTags(metadata, lyrics = null, enhanced = null) {
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
            ['COMMENT', metadata.comment],
            ['REPLAYGAIN_TRACK_GAIN', metadata.replayGain || ''],
            ['AUDIO_QUALITY', `${metadata.bitDepth}bit/${metadata.sampleRate}kHz`],
            ['SOURCE', 'Qobuz'],

            ['QOBUZ_TRACK_ID', metadata.qobuzTrackId],
            ['QOBUZ_ALBUM_ID', metadata.qobuzAlbumId],
            ['QOBUZ_ARTIST_ID', metadata.qobuzArtistId]
        ];

        if (enhanced?.merged) {
            const m = enhanced.merged;
            if (m.bpm) comments.push(['BPM', m.bpm.toString()]);
            if (m.key) comments.push(['KEY', `${m.key} ${m.mode || ''}`]);
            if (m.timeSignature) comments.push(['TIMESIGNATURE', `${m.timeSignature}/4`]);
            if (m.danceability) comments.push(['DANCEABILITY', m.danceability.toString()]);
            if (m.energy) comments.push(['ENERGY', m.energy.toString()]);
            if (m.valence) comments.push(['MOOD', m.valence > 50 ? 'Happy' : 'Sad']);
            if (m.valence) comments.push(['VALENCE', m.valence.toString()]);
            if (m.acousticness) comments.push(['ACOUSTICNESS', m.acousticness.toString()]);
            if (m.instrumentalness) comments.push(['INSTRUMENTALNESS', m.instrumentalness.toString()]);
            if (m.liveness) comments.push(['LIVENESS', m.liveness.toString()]);
            if (m.speechiness) comments.push(['SPEECHINESS', m.speechiness.toString()]);
            if (m.loudness) comments.push(['LOUDNESS', m.loudness.toString()]);
            if (m.popularity) comments.push(['POPULARITY', m.popularity.toString()]);
            if (m.genres) comments.push(['SPOTIFY_GENRES', m.genres]);
            if (m.spotifyId) comments.push(['SPOTIFY_TRACK_ID', m.spotifyId]);
            if (m.spotifyUri) comments.push(['SPOTIFY_URI', m.spotifyUri]);
        }

        if (enhanced?.itunes) {
            const i = enhanced.itunes;
            if (i.itunesTrackId) comments.push(['ITUNES_TRACK_ID', i.itunesTrackId]);
            if (i.itunesCopyright) comments.push(['ITUNES_COPYRIGHT', i.itunesCopyright]);
            if (i.itunesGenre && !metadata.genre) comments.push(['GENRE', i.itunesGenre]);
            if (i.itunesTrackViewUrl) comments.push(['APPLE_MUSIC_URL', i.itunesTrackViewUrl]);
        }

        if (lyrics) {

            if (lyrics.plainLyrics) {
                comments.push(['LYRICS', lyrics.plainLyrics]);
                comments.push(['UNSYNCEDLYRICS', lyrics.plainLyrics]);
            }


            if (lyrics.syncedLyrics) {
                comments.push(['SYNCEDLYRICS', lyrics.syncedLyrics]);
                comments.push(['LYRICS_SYNCED', lyrics.syncedLyrics]);
            }


            if (lyrics.source) {
                comments.push(['LYRICS_SOURCE', lyrics.source]);
            }
        }


        return comments.filter(([key, value]) => value && value.toString().trim());
    }

    /**
     * Write ID3 tags to MP3 file
     */
    async writeId3Tags(filePath, tags) {
        return new Promise((resolve, reject) => {
            const success = NodeID3.write(tags, filePath);
            if (success) {
                resolve({ success: true });
            } else {
                reject(new Error('Failed to write ID3 tags'));
            }
        });
    }

    /**
     * Get metadata display for CLI
     */
    getMetadataDisplay(metadata) {
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
