import { createAxiosInstance } from '../utils/network.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

import { AxiosInstance } from 'axios';

export interface SpotifyTrack {
    title: string;
    artist: string;
    album: string;
    duration_ms: number;
    isrc?: string;
}

interface SpotifyArtist {
    name: string;
}

class SpotifyAPI {
    private client: AxiosInstance;

    private accessToken: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.client = createAxiosInstance({
            timeout: 10000
        });
    }

    private async ensureToken(): Promise<boolean> {
        const { clientId, clientSecret } = CONFIG.spotify;
        if (!clientId || !clientSecret) {
            throw new Error('Spotify Client ID or Client Secret is missing in settings.');
        }

        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return true;
        }

        try {
            const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const response = await this.client.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000;
            logger.info('Spotify API: Successfully authenticated', 'SPOTIFY');
            return true;
        } catch (error: unknown) {
            const err = error as any;
            logger.error(`Spotify Auth Error: ${err.response?.data?.error || err.message}`, 'SPOTIFY');
            return false;
        }

    }

    async getPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
        await this.ensureToken();

        const tracks: SpotifyTrack[] = [];
        let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;

        try {
            while (url) {
                const response = await this.client.get(url, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                });

                const items = response.data.items;
                for (const item of items) {
                    if (!item.track) continue;
                    tracks.push({
                        title: item.track.name,
                        artist: item.track.artists.map((a: SpotifyArtist) => a.name).join(', '),
                        album: item.track.album.name,
                        duration_ms: item.track.duration_ms,
                        isrc: item.track.external_ids?.isrc
                    });

                }

                url = response.data.next;
            }
            return tracks;
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`Spotify Playlist Error: ${err.message}`, 'SPOTIFY');
            throw error;
        }

    }

    async getAlbumTracks(albumId: string): Promise<SpotifyTrack[]> {
        await this.ensureToken();

        try {
            const albumRes = await this.client.get(`https://api.spotify.com/v1/albums/${albumId}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });

            const albumName = albumRes.data.name;
            const tracks: SpotifyTrack[] = [];
            let url = `https://api.spotify.com/v1/albums/${albumId}/tracks?limit=50`;

            while (url) {
                const response = await this.client.get(url, {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                });

                for (const item of response.data.items) {
                    tracks.push({
                        title: item.name,
                        artist: item.artists.map((a: SpotifyArtist) => a.name).join(', '),
                        album: albumName,
                        duration_ms: item.duration_ms
                    });
                }

                url = response.data.next;
            }
            return tracks;
        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`Spotify Album Error: ${err.message}`, 'SPOTIFY');
            throw error;
        }

    }

    async getTrack(trackId: string): Promise<SpotifyTrack | null> {
        await this.ensureToken();
        try {
            const response = await this.client.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            return {
                title: response.data.name,
                artist: response.data.artists.map((a: SpotifyArtist) => a.name).join(', '),
                album: response.data.album.name,
                duration_ms: response.data.duration_ms,
                isrc: response.data.external_ids?.isrc
            };

        } catch (error: unknown) {
            const err = error as Error;
            logger.error(`Spotify Track Error: ${err.message}`, 'SPOTIFY');
            return null;
        }

    }

    extractId(url: string): { id: string; type: 'playlist' | 'album' | 'track' } | null {
        const playlistMatch = url.match(/playlist\/([a-zA-Z0-9]+)/);
        if (playlistMatch) return { id: playlistMatch[1], type: 'playlist' };

        const albumMatch = url.match(/album\/([a-zA-Z0-9]+)/);
        if (albumMatch) return { id: albumMatch[1], type: 'album' };

        const trackMatch = url.match(/track\/([a-zA-Z0-9]+)/);
        if (trackMatch) return { id: trackMatch[1], type: 'track' };

        return null;
    }
}

export const spotifyApi = new SpotifyAPI();
