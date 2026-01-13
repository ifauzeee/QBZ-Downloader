import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { APIError, AuthenticationError } from '../utils/errors.js';
import { refreshUserToken } from '../utils/token.js';

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
}

class QobuzAPI {
    baseUrl: string;
    appId: string;
    appSecret: string;
    token: string;
    userId: string;
    client: AxiosInstance;

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

        this.setupInterceptors();
    }

    setupInterceptors() {
        this.client.interceptors.response.use(
            (response) => response,
            async (error) => {
                const originalRequest = error.config;

                if (
                    (error.response?.status === 401 || error.response?.status === 403) &&
                    !originalRequest._retry
                ) {
                    originalRequest._retry = true;

                    try {
                        const newToken = await refreshUserToken();
                        if (newToken) {
                            this.token = newToken;
                            CONFIG.credentials.token = newToken;

                            if (originalRequest.params) {
                                originalRequest.params.user_auth_token = newToken;
                            }

                            return this.client(originalRequest);
                        }
                    } catch (e) {
                        return Promise.reject(error);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    generateSignature(trackId: string | number, formatId: number, intent = 'stream') {
        const timestamp = Math.floor(Date.now() / 1000);
        const data = `trackgetFileUrlformat_id${formatId}intent${intent}track_id${trackId}${timestamp}${this.appSecret}`;
        const signature = crypto.createHash('md5').update(data).digest('hex');
        return { timestamp, signature };
    }

    async getTrack(trackId: string | number): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getAlbum(albumId: string | number): Promise<ApiResponse> {
        try {
            const response = await this.client.get('/album/get', {
                params: {
                    album_id: albumId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albumsFromSameArtist,focus'
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getArtist(artistId: string | number, offset = 0, limit = 20): Promise<ApiResponse> {
        try {
            const response = await this.client.get('/artist/get', {
                params: {
                    artist_id: artistId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albums,focus',
                    album_offset: offset,
                    album_limit: limit
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getPlaylist(playlistId: string | number): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async search(query: string, type = 'albums', limit = 20): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getFileUrl(trackId: string | number, formatId = 27): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getUserInfo(): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getLyrics(trackId: string | number): Promise<ApiResponse> {
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
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getGoodies(albumId: string | number): Promise<ApiResponse> {
        try {
            const albumInfo = await this.getAlbum(albumId);
            if (albumInfo.success && albumInfo.data.goodies) {
                return { success: true, data: albumInfo.data.goodies };
            }
            return { success: false, error: 'No goodies available' };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    handleApiError(error: any) {
        const statusCode = error.response?.status;
        const data = error.response?.data;
        const message = data?.message || data?.error || error.message;

        if (statusCode === 401 || statusCode === 403) {
            throw new AuthenticationError(message);
        }
        throw new APIError(message, statusCode);
    }

    parseUrl(url: string) {
        const patterns = {
            track: new RegExp('/track/(\\d+)'),
            album: new RegExp('/album/[^/]+/([a-zA-Z0-9]+)'),
            artist: new RegExp('/artist/(\\d+)'),
            playlist: new RegExp('/playlist/(\\d+)'),
            label: new RegExp('/label/[^/]+/(\\d+)')
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
