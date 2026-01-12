import axios from 'axios';

class iTunesAPI {
    constructor() {
        this.baseUrl = 'https://itunes.apple.com';
    }

    async searchTrack(title, artist, album = '') {
        try {
            let term = `${title} ${artist}`;
            if (album) term += ` ${album}`;

            const response = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    term: term,
                    media: 'music',
                    entity: 'song',
                    limit: 10
                },
                timeout: 10000
            });

            if (response.data.resultCount > 0) {
                return { success: true, data: response.data.results };
            }

            const fallbackResponse = await axios.get(`${this.baseUrl}/search`, {
                params: {
                    term: `${title} ${artist}`,
                    media: 'music',
                    entity: 'song',
                    limit: 10
                },
                timeout: 10000
            });

            if (fallbackResponse.data.resultCount > 0) {
                return { success: true, data: fallbackResponse.data.results };
            }

            return { success: false, error: 'No tracks found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async lookup(id, entity = 'song') {
        try {
            const response = await axios.get(`${this.baseUrl}/lookup`, {
                params: {
                    id: id,
                    entity: entity
                },
                timeout: 10000
            });

            if (response.data.resultCount > 0) {
                return { success: true, data: response.data.results };
            }

            return { success: false, error: 'Not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    extractMetadata(itunesTrack) {
        if (!itunesTrack) return {};

        let artworkUrl = itunesTrack.artworkUrl100 || '';
        if (artworkUrl) {
            artworkUrl = artworkUrl.replace('100x100bb', '3000x3000bb');
        }

        return {
            itunesTrackId: itunesTrack.trackId?.toString() || '',
            itunesArtistId: itunesTrack.artistId?.toString() || '',
            itunesCollectionId: itunesTrack.collectionId?.toString() || '',

            itunesTitle: itunesTrack.trackName || '',
            itunesArtist: itunesTrack.artistName || '',
            itunesAlbum: itunesTrack.collectionName || '',
            itunesAlbumArtist: itunesTrack.collectionArtistName || itunesTrack.artistName || '',

            itunesReleaseDate: itunesTrack.releaseDate || '',
            itunesYear: itunesTrack.releaseDate ? new Date(itunesTrack.releaseDate).getFullYear() : '',

            itunesTrackNumber: itunesTrack.trackNumber || 0,
            itunesTotalTracks: itunesTrack.trackCount || 0,
            itunesDiscNumber: itunesTrack.discNumber || 1,
            itunesTotalDiscs: itunesTrack.discCount || 1,
            itunsDurationMs: itunesTrack.trackTimeMillis || 0,

            itunesGenre: itunesTrack.primaryGenreName || '',

            itunesExplicit: itunesTrack.trackExplicitness === 'explicit',
            itunesContentAdvisoryRating: itunesTrack.contentAdvisoryRating || '',

            itunesPrice: itunesTrack.trackPrice || 0,
            itunesCurrency: itunesTrack.currency || '',
            itunesCountry: itunesTrack.country || '',

            itunesCollectionType: itunesTrack.collectionType || '',
            itunesCopyright: itunesTrack.copyright || '',

            itunesCoverUrl: artworkUrl,
            itunesCoverUrl100: itunesTrack.artworkUrl100 || '',
            itunesCoverUrl60: itunesTrack.artworkUrl60 || '',

            itunesPreviewUrl: itunesTrack.previewUrl || '',

            itunesTrackViewUrl: itunesTrack.trackViewUrl || '',
            itunesArtistViewUrl: itunesTrack.artistViewUrl || '',
            itunesCollectionViewUrl: itunesTrack.collectionViewUrl || '',

            itunesStreamable: itunesTrack.isStreamable || false
        };
    }

    async getEnhancedMetadata(title, artist, album = '') {
        const searchResult = await this.searchTrack(title, artist, album);

        if (!searchResult.success || !searchResult.data?.length) {
            return { success: false, error: 'Track not found on iTunes' };
        }

        const bestMatch = this.findBestMatch(searchResult.data, title, artist, album);

        if (!bestMatch) {
            return { success: false, error: 'No matching track found' };
        }

        const metadata = this.extractMetadata(bestMatch);

        return { success: true, data: metadata };
    }

    findBestMatch(tracks, title, artist, album) {
        const normalize = str => str.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalTitle = normalize(title);
        const normalArtist = normalize(artist);
        const normalAlbum = normalize(album);

        let bestScore = 0;
        let bestTrack = null;

        for (const track of tracks) {
            let score = 0;
            const trackTitle = normalize(track.trackName || '');
            const trackArtist = normalize(track.artistName || '');
            const trackAlbum = normalize(track.collectionName || '');

            if (trackTitle === normalTitle) score += 50;
            else if (trackTitle.includes(normalTitle) || normalTitle.includes(trackTitle)) score += 30;

            if (trackArtist.includes(normalArtist) || normalArtist.includes(trackArtist)) score += 30;

            if (album && (trackAlbum === normalAlbum || trackAlbum.includes(normalAlbum))) score += 20;

            if (score > bestScore) {
                bestScore = score;
                bestTrack = track;
            }
        }

        return bestScore >= 50 ? bestTrack : tracks[0];
    }
}

export default iTunesAPI;
