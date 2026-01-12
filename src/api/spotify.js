import axios from 'axios';

class SpotifyAPI {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.baseUrl = 'https://api.spotify.com/v1';
    }

    async getAccessToken() {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const response = await axios.post(
                'https://accounts.spotify.com/api/token',
                'grant_type=client_credentials',
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
                    },
                    timeout: 10000
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000;
            return this.accessToken;
        } catch (error) {
            console.error('Spotify auth failed:', error.message);
            return null;
        }
    }

    async searchTrack(title, artist, album = '') {
        try {
            const token = await this.getAccessToken();
            if (!token) return { success: false, error: 'No access token' };

            let query = `track:${title} artist:${artist}`;
            if (album) query += ` album:${album}`;

            const response = await axios.get(`${this.baseUrl}/search`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: query,
                    type: 'track',
                    limit: 5
                },
                timeout: 10000
            });

            if (response.data.tracks?.items?.length > 0) {
                return { success: true, data: response.data.tracks.items };
            }

            const fallbackResponse = await axios.get(`${this.baseUrl}/search`, {
                headers: { 'Authorization': `Bearer ${token}` },
                params: {
                    q: `${title} ${artist}`,
                    type: 'track',
                    limit: 5
                },
                timeout: 10000
            });

            if (fallbackResponse.data.tracks?.items?.length > 0) {
                return { success: true, data: fallbackResponse.data.tracks.items };
            }

            return { success: false, error: 'No tracks found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getTrackDetails(trackId) {
        try {
            const token = await this.getAccessToken();
            if (!token) return { success: false, error: 'No access token' };

            const [trackResponse, featuresResponse] = await Promise.all([
                axios.get(`${this.baseUrl}/tracks/${trackId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 10000
                }),
                axios.get(`${this.baseUrl}/audio-features/${trackId}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    timeout: 10000
                }).catch(() => ({ data: null }))
            ]);

            return {
                success: true,
                data: {
                    track: trackResponse.data,
                    audioFeatures: featuresResponse.data
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getAlbumDetails(albumId) {
        try {
            const token = await this.getAccessToken();
            if (!token) return { success: false, error: 'No access token' };

            const response = await axios.get(`${this.baseUrl}/albums/${albumId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 10000
            });

            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getArtistDetails(artistId) {
        try {
            const token = await this.getAccessToken();
            if (!token) return { success: false, error: 'No access token' };

            const response = await axios.get(`${this.baseUrl}/artists/${artistId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 10000
            });

            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    extractMetadata(spotifyTrack, audioFeatures = null, artistDetails = null) {
        if (!spotifyTrack) return {};

        const metadata = {
            spotifyTrackId: spotifyTrack.id || '',
            spotifyAlbumId: spotifyTrack.album?.id || '',
            spotifyArtistId: spotifyTrack.artists?.[0]?.id || '',
            spotifyUri: spotifyTrack.uri || '',

            spotifyTitle: spotifyTrack.name || '',
            spotifyArtists: spotifyTrack.artists?.map(a => a.name).join(', ') || '',
            spotifyAlbum: spotifyTrack.album?.name || '',
            spotifyReleaseDate: spotifyTrack.album?.release_date || '',
            spotifyReleaseDatePrecision: spotifyTrack.album?.release_date_precision || '',
            spotifyTrackNumber: spotifyTrack.track_number || 0,
            spotifyTotalTracks: spotifyTrack.album?.total_tracks || 0,
            spotifyDiscNumber: spotifyTrack.disc_number || 1,
            spotifyDurationMs: spotifyTrack.duration_ms || 0,
            spotifyExplicit: spotifyTrack.explicit || false,
            spotifyPopularity: spotifyTrack.popularity || 0,

            spotifyAlbumType: spotifyTrack.album?.album_type || '',
            spotifyLabel: spotifyTrack.album?.label || '',
            spotifyAlbumArtists: spotifyTrack.album?.artists?.map(a => a.name).join(', ') || '',

            spotifyCoverUrl: spotifyTrack.album?.images?.[0]?.url || '',
            spotifyCoverUrlSmall: spotifyTrack.album?.images?.[2]?.url || '',

            spotifyIsrc: spotifyTrack.external_ids?.isrc || '',
            spotifyEan: spotifyTrack.external_ids?.ean || '',
            spotifyUpc: spotifyTrack.external_ids?.upc || '',

            spotifyAvailableMarkets: spotifyTrack.available_markets?.length || 0
        };

        if (audioFeatures) {
            metadata.spotifyBpm = Math.round(audioFeatures.tempo) || 0;
            metadata.spotifyKey = this.keyToString(audioFeatures.key) || '';
            metadata.spotifyMode = audioFeatures.mode === 1 ? 'Major' : 'Minor';
            metadata.spotifyTimeSignature = audioFeatures.time_signature || 4;
            metadata.spotifyDanceability = Math.round(audioFeatures.danceability * 100) || 0;
            metadata.spotifyEnergy = Math.round(audioFeatures.energy * 100) || 0;
            metadata.spotifyValence = Math.round(audioFeatures.valence * 100) || 0;
            metadata.spotifyAcousticness = Math.round(audioFeatures.acousticness * 100) || 0;
            metadata.spotifyInstrumentalness = Math.round(audioFeatures.instrumentalness * 100) || 0;
            metadata.spotifyLiveness = Math.round(audioFeatures.liveness * 100) || 0;
            metadata.spotifySpeechiness = Math.round(audioFeatures.speechiness * 100) || 0;
            metadata.spotifyLoudness = audioFeatures.loudness || 0;
        }

        if (artistDetails) {
            metadata.spotifyGenres = artistDetails.genres?.join(', ') || '';
            metadata.spotifyArtistPopularity = artistDetails.popularity || 0;
            metadata.spotifyArtistFollowers = artistDetails.followers?.total || 0;
        }

        return metadata;
    }

    keyToString(key) {
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return key >= 0 && key < 12 ? keys[key] : '';
    }

    async getEnhancedMetadata(title, artist, album = '') {
        const searchResult = await this.searchTrack(title, artist, album);

        if (!searchResult.success || !searchResult.data?.length) {
            return { success: false, error: 'Track not found on Spotify' };
        }

        const bestMatch = this.findBestMatch(searchResult.data, title, artist, album);

        if (!bestMatch) {
            return { success: false, error: 'No matching track found' };
        }

        const [trackDetails, artistDetails] = await Promise.all([
            this.getTrackDetails(bestMatch.id),
            this.getArtistDetails(bestMatch.artists?.[0]?.id)
        ]);

        const audioFeatures = trackDetails.success ? trackDetails.data.audioFeatures : null;
        const artistData = artistDetails.success ? artistDetails.data : null;

        const metadata = this.extractMetadata(bestMatch, audioFeatures, artistData);

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
            const trackTitle = normalize(track.name || '');
            const trackArtist = normalize(track.artists?.map(a => a.name).join(' ') || '');
            const trackAlbum = normalize(track.album?.name || '');

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

export default SpotifyAPI;
