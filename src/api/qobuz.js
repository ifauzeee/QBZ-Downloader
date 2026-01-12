import axios from 'axios';
import crypto from 'crypto';
import { CONFIG } from '../config.js';

class QobuzAPI {
    constructor() {
        this.baseUrl = CONFIG.api.baseUrl;
        this.appId = CONFIG.credentials.appId;
        this.appSecret = CONFIG.credentials.appSecret;
        this.token = CONFIG.credentials.token;
        this.userId = CONFIG.credentials.userId;

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'X-App-Id': this.appId
            }
        });
    }

    generateSignature(trackId, formatId, intent = 'stream') {
        const timestamp = Math.floor(Date.now() / 1000);
        const data = `trackgetFileUrlformat_id${formatId}intent${intent}track_id${trackId}${timestamp}${this.appSecret}`;
        const signature = crypto.createHash('md5').update(data).digest('hex');
        return { timestamp, signature };
    }

    async getTrack(trackId) {
        try {
            const response = await this.client.get('/track/get', {
                params: {
                    track_id: trackId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'track_url,lyrics'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async getAlbum(albumId) {
        try {
            const response = await this.client.get('/album/get', {
                params: {
                    album_id: albumId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albumsFromSameArtist,focus,lyrics,credits'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async getArtist(artistId) {
        try {
            const response = await this.client.get('/artist/get', {
                params: {
                    artist_id: artistId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albums,focus'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async getPlaylist(playlistId) {
        try {
            const response = await this.client.get('/playlist/get', {
                params: {
                    playlist_id: playlistId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'tracks,subscribers'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async search(query, type = 'albums', limit = 20) {
        try {
            const response = await this.client.get('/catalog/search', {
                params: {
                    query: query,
                    type: type,
                    limit: limit,
                    app_id: this.appId,
                    user_auth_token: this.token
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async getFileUrl(trackId, formatId = 27) {
        try {
            const { timestamp, signature } = this.generateSignature(trackId, formatId);

            const response = await this.client.get('/track/getFileUrl', {
                params: {
                    track_id: trackId,
                    format_id: formatId,
                    intent: 'stream',
                    request_ts: timestamp,
                    request_sig: signature,
                    app_id: this.appId,
                    user_auth_token: this.token
                }
            });

            return { success: true, data: response.data };
        } catch (error) {
            if (formatId === 27) {
                return await this.getFileUrl(trackId, 7);
            } else if (formatId === 7) {
                return await this.getFileUrl(trackId, 6);
            }

            const errorMessage = error.response?.data || error.message;
            return {
                success: false,
                error: typeof errorMessage === 'object' ? JSON.stringify(errorMessage) : errorMessage
            };
        }
    }

    async getUserInfo() {
        try {
            const response = await this.client.get('/user/get', {
                params: {
                    user_id: this.userId,
                    app_id: this.appId,
                    user_auth_token: this.token
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            return { success: false, error: error.response?.data || error.message };
        }
    }

    async getLyrics(trackId) {
        try {
            const trackInfo = await this.getTrack(trackId);
            if (trackInfo.success && trackInfo.data.lyrics) {
                return {
                    success: true,
                    data: {
                        synced: trackInfo.data.lyrics.sync || null,
                        unsynced: trackInfo.data.lyrics.text || null,
                        copyright: trackInfo.data.lyrics.copyright || null,
                        writer: trackInfo.data.lyrics.writer || null
                    }
                };
            }
            return { success: false, error: 'No lyrics available' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getGoodies(albumId) {
        try {
            const albumInfo = await this.getAlbum(albumId);
            if (albumInfo.success && albumInfo.data.goodies) {
                return { success: true, data: albumInfo.data.goodies };
            }
            return { success: false, error: 'No goodies available' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    parseUrl(url) {
        const patterns = {
            track: /\/track\/(\d+)/,
            album: /\/album\/[^\/]+\/([a-zA-Z0-9]+)/,
            artist: /\/artist\/(\d+)/,
            playlist: /\/playlist\/(\d+)/,
            label: /\/label\/[^\/]+\/(\d+)/
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            const match = url.match(pattern);
            if (match) {
                return { type, id: match[1] };
            }
        }

        if (/^\d+$/.test(url)) {
            return { type: 'album', id: url };
        }

        return null;
    }
}

export default QobuzAPI;
