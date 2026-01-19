import { createAxiosInstance } from '../utils/network.js';
import { cacheService } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { CONFIG } from '../config.js';
import { APIError, AuthenticationError } from '../utils/errors.js';
import { refreshUserToken } from '../utils/token.js';
import { URL_PATTERNS } from '../constants.js';

import { Album, Track, UserInfo, SearchResults, LyricsResult, Playlist } from '../types/qobuz.js';

interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}

class QobuzAPI {
    baseUrl: string;
    client: AxiosInstance;

    get appId() {
        return CONFIG.credentials.appId;
    }
    set appId(val: string) {
        process.env.QOBUZ_APP_ID = val;
    }

    get appSecret() {
        return CONFIG.credentials.appSecret;
    }
    set appSecret(val: string) {
        process.env.QOBUZ_APP_SECRET = val;
    }

    get token() {
        return CONFIG.credentials.token;
    }
    set token(val: string) {
        process.env.QOBUZ_USER_AUTH_TOKEN = val;
    }

    get userId() {
        return CONFIG.credentials.userId;
    }
    set userId(val: string) {
        process.env.QOBUZ_USER_ID = val;
    }

    constructor() {
        this.baseUrl = CONFIG.api.baseUrl;

        this.client = createAxiosInstance({
            baseURL: this.baseUrl,
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                get 'X-App-Id'() {
                    return CONFIG.credentials.appId;
                },
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        this.client.interceptors.request.use((config) => {
            config.headers['X-App-Id'] = this.appId;
            return config;
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

                            if (originalRequest.params) {
                                originalRequest.params.user_auth_token = newToken;
                            }

                            return this.client(originalRequest as AxiosRequestConfig);
                        }
                    } catch {
                        return Promise.reject(error);
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    generateSignature(trackId: string | number, formatId: number, intent = 'stream') {
        const timestamp = Math.floor(Date.now() / 1000);
        const secret = CONFIG.credentials.appSecret;
        const data = `trackgetFileUrlformat_id${formatId}intent${intent}track_id${trackId}${timestamp}${secret}`;
        const signature = crypto.createHash('md5').update(data).digest('hex');
        return { timestamp, signature };
    }

    async getTrack(trackId: string | number): Promise<ApiResponse<Track>> {
        const cacheKey = `track:${trackId}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return { success: true, data: cached };

        try {
            const response = await this.client.get('/track/get', {
                params: {
                    track_id: trackId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'track_url,lyrics'
                }
            });
            await cacheService.set(cacheKey, response.data, 3600);
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getAlbum(albumId: string | number): Promise<ApiResponse<Album>> {
        const cacheKey = `album:${albumId}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return { success: true, data: cached };

        try {
            const response = await this.client.get('/album/get', {
                params: {
                    album_id: albumId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albumsFromSameArtist,focus'
                }
            });
            await cacheService.set(cacheKey, response.data, 3600);
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getArtist(
        artistId: string | number,
        albumOffset = 0,
        albumLimit = 20,
        trackOffset = 0,
        trackLimit = 25
    ): Promise<ApiResponse> {
        const cacheKey = `artist:${artistId}:${albumOffset}:${albumLimit}:${trackOffset}:${trackLimit}`;
        const cached = await cacheService.get(cacheKey);
        if (cached) return { success: true, data: cached };

        try {
            const response = await this.client.get('/artist/get', {
                params: {
                    artist_id: artistId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albums,tracks,focus',
                    album_offset: albumOffset,
                    album_limit: albumLimit,
                    track_offset: trackOffset,
                    track_limit: trackLimit,
                    offset: albumOffset,
                    limit: albumLimit
                }
            });

            if (response.data?.albums) {
                logger.debug(
                    `[QobuzAPI] Artist Album Response - Requested Offset: ${albumOffset} | Returned: ${response.data.albums.offset} | Count: ${response.data.albums.items?.length}`
                );
            }

            await cacheService.set(cacheKey, response.data, 1800);
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getArtistAlbums(artistId: string | number, limit = 20, offset = 0): Promise<ApiResponse> {
        try {
            const response = await this.client.get('/artist/get', {
                params: {
                    artist_id: artistId,
                    app_id: this.appId,
                    user_auth_token: this.token,
                    extra: 'albums',
                    album_limit: limit,
                    album_offset: offset,
                    offset: offset,
                    limit: limit
                }
            });
            return { success: true, data: response.data };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    async getPlaylist(playlistId: string | number): Promise<ApiResponse<Playlist>> {
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

    async getGenres(): Promise<ApiResponse> {
        try {
            const response = await this.client.get('/genre/list', {
                params: {
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

    async search(
        query: string,
        type = 'albums',
        limit = 20,
        offset = 0
    ): Promise<ApiResponse<SearchResults>> {
        try {
            const response = await this.client.get('/catalog/search', {
                params: {
                    query: query,
                    type: type,
                    limit: limit,
                    offset: offset,
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

            if (response.data) {
                let detectedFormat = formatId;
                const { bit_depth, sampling_rate, mime_type } = response.data;

                if (mime_type === 'audio/mpeg' || mime_type === 'audio/mp3') {
                    detectedFormat = 5;
                } else if (bit_depth === 16) {
                    detectedFormat = 6;
                } else if (bit_depth === 24) {
                    if (sampling_rate >= 176.4) {
                        detectedFormat = 27;
                    } else {
                        detectedFormat = 7;
                    }
                }

                response.data.format_id = detectedFormat;

                if (
                    response.data.sample ||
                    (response.data.duration && response.data.duration <= 30)
                ) {
                    logger.warn(`Track ${trackId} returned as a SAMPLE/PREVIEW (30s limit)`, 'API');

                    const debugInfo = {
                        duration: response.data.duration,
                        sample: response.data.sample,
                        restrictions: response.data.restrictions,
                        format_id: response.data.format_id
                    };

                    logger.debug(`Sample Details: ${JSON.stringify(debugInfo, null, 2)}`, 'API');
                }
            }

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

    async getUserInfo(): Promise<ApiResponse<UserInfo>> {
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

    async getLyrics(trackId: string | number): Promise<ApiResponse<LyricsResult>> {
        try {
            const trackInfo = await this.getTrack(trackId);
            if (trackInfo.success && trackInfo.data && trackInfo.data.lyrics) {
                return {
                    success: true,
                    data: {
                        success: true,
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
            if (albumInfo.success && albumInfo.data && albumInfo.data.goodies) {
                return { success: true, data: albumInfo.data.goodies };
            }
            return { success: false, error: 'No goodies available' };
        } catch (error) {
            this.handleApiError(error);
            return { success: false, error: 'API Error' };
        }
    }

    handleApiError(error: unknown) {
        const err = error as AxiosError;
        const statusCode = err.response?.status;
        const data = err.response?.data as Record<string, unknown> | undefined;
        const rawMessage = data?.message || data?.error || err.message;
        const message = typeof rawMessage === 'string' ? rawMessage : 'Unknown error';

        if (statusCode === 401 || statusCode === 403) {
            throw new AuthenticationError(message || 'Authentication failed');
        }

        throw new APIError(message || 'API Error', statusCode);
    }

    parseUrl(url: string) {
        const patterns = {
            track: URL_PATTERNS.TRACK,
            album: URL_PATTERNS.ALBUM,
            artist: URL_PATTERNS.ARTIST,
            playlist: URL_PATTERNS.PLAYLIST,
            label: URL_PATTERNS.LABEL
        };

        for (const [type, pattern] of Object.entries(patterns)) {
            const match = url.match(pattern);
            if (match) {
                return { type, id: match[1] };
            }
        }

        if (URL_PATTERNS.NUMERIC_ID.test(url)) {
            return { type: 'album', id: url };
        }

        return null;
    }
}

export default QobuzAPI;
