import axios from 'axios';
import { CONFIG } from '../config.js';

class SpotifyAPI {
    constructor() {
        this.clientId = CONFIG.credentials.spotifyClientId;
        this.clientSecret = CONFIG.credentials.spotifyClientSecret;
        this.token = null;
        this.tokenExpiresAt = 0;
    }

    async ensureToken() {
        if (this.token && Date.now() < this.tokenExpiresAt) return;

        if (!this.clientId || !this.clientSecret) {
            return false;
        }

        try {
            const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            const response = await axios.post(
                'https://accounts.spotify.com/api/token',
                new URLSearchParams({ grant_type: 'client_credentials' }),
                {
                    headers: {
                        Authorization: `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.token = response.data.access_token;
            this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000 - 60000;
            return true;
        } catch (error) {
            return false;
        }
    }

    async searchTrack(title, artist, _album = '') {
        if (!(await this.ensureToken())) return null;

        try {
            const cleanTitle = title.replace(/\(feat\..*\)/i, '').trim();
            const query = `track:${cleanTitle} artist:${artist}`;

            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: { Authorization: `Bearer ${this.token}` },
                params: { q: query, type: 'track', limit: 1 }
            });

            return response.data.tracks.items[0] || null;
        } catch (error) {
            return null;
        }
    }

    async getAudioFeatures(trackId) {
        if (!(await this.ensureToken())) return null;

        try {
            const response = await axios.get(
                `https://api.spotify.com/v1/audio-features/${trackId}`,
                {
                    headers: { Authorization: `Bearer ${this.token}` }
                }
            );
            return response.data;
        } catch (error) {
            return null;
        }
    }

    async getArtist(artistId) {
        if (!(await this.ensureToken())) return null;

        try {
            const response = await axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
                headers: { Authorization: `Bearer ${this.token}` }
            });
            return response.data;
        } catch (e) {
            return null;
        }
    }

    mapSpotifyKey(key, _mode) {
        if (key === null || key === undefined) return null;
        const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return keys[key];
    }

    async getTrackInfo(title, artist, album = '', isrc = null) {
        let track = null;

        if (isrc) {
            if (!(await this.ensureToken())) return null;
            try {
                const response = await axios.get('https://api.spotify.com/v1/search', {
                    headers: { Authorization: `Bearer ${this.token}` },
                    params: { q: `isrc:${isrc}`, type: 'track', limit: 1 }
                });
                track = response.data.tracks.items[0];
            } catch (e) {
                /* ignored */
            }
        }

        if (!track) {
            track = await this.searchTrack(title, artist, album);
        }

        if (!track) return null;

        const features = await this.getAudioFeatures(track.id);

        let genres = [];
        if (track.artists && track.artists.length > 0) {
            const artistInfo = await this.getArtist(track.artists[0].id);
            if (artistInfo && artistInfo.genres) genres = artistInfo.genres;
        }

        const spotifyArtists = track.artists?.map((a) => a.name) || [];

        return {
            spotifyId: track.id,
            spotifyUri: track.uri,
            spotifyArtists: spotifyArtists,
            spotifyArtistString: spotifyArtists.join('; '),
            bpm: features?.tempo ? Math.round(features.tempo) : null,
            key: this.mapSpotifyKey(features?.key),
            mode: features?.mode === 1 ? 'Major' : 'Minor',
            danceability: features?.danceability,
            energy: features?.energy,
            valence: features?.valence,
            acousticness: features?.acousticness,
            instrumentalness: features?.instrumentalness,
            liveness: features?.liveness,
            speechiness: features?.speechiness,
            loudness: features?.loudness,
            timeSignature: features?.time_signature,
            popularity: track.popularity,
            genres: genres.slice(0, 5).join('; ')
        };
    }
}

export default SpotifyAPI;
