import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QobuzAPI } from './qobuz.js';

const { mockClient, mockGet } = vi.hoisted(() => {
    const mockGet = vi.fn();
    return {
        mockGet,
        mockClient: {
            get: mockGet,
            interceptors: {
                request: { use: vi.fn() },
                response: { use: vi.fn() }
            }
        }
    };
});

vi.mock('../utils/network.js', () => ({
    createAxiosInstance: vi.fn(() => mockClient)
}));

vi.mock('../utils/cache.js', () => ({
    cacheService: {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined)
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

vi.mock('../utils/token.js', () => ({
    refreshUserToken: vi.fn()
}));

vi.mock('../services/settings.js', () => ({
    settingsService: {
        get: vi.fn(),
        set: vi.fn()
    }
}));

vi.mock('../config.js', () => ({
    CONFIG: {
        api: { baseUrl: 'https://example.test' },
        credentials: {
            appId: 'app-id',
            appSecret: 'app-secret',
            token: 'token',
            userId: 'user-id'
        },
        download: {
            retryAttempts: 2,
            retryDelay: 1000,
            concurrent: 2
        }
    },
    normalizeDownloadQuality: vi.fn((value) => Number(value))
}));

const flushPromises = async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
};

describe('QobuzAPI rate limiting and retry handling', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockGet.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should honor Retry-After when retrying 429 responses', async () => {
        const api = new QobuzAPI();
        mockGet
            .mockRejectedValueOnce({
                message: 'Too Many Requests',
                response: {
                    status: 429,
                    headers: { 'retry-after': '2' },
                    data: { message: 'Too Many Requests' }
                }
            })
            .mockResolvedValueOnce({ data: { id: 'track-1' } });

        const resultPromise = api.getTrack('track-1');
        await flushPromises();

        expect(mockGet).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1999);
        expect(mockGet).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        const result = await resultPromise;

        expect(mockGet).toHaveBeenCalledTimes(2);
        expect(result).toEqual({ success: true, data: { id: 'track-1' } });
    });

    it('should serialize bursts through the request rate limiter', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({ data: { ok: true } });

        const first = api.getTrack('track-1');
        const second = api.getAlbum('album-1');
        await flushPromises();

        expect(mockGet).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(249);
        expect(mockGet).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(1);
        await Promise.all([first, second]);

        expect(mockGet).toHaveBeenCalledTimes(2);
    });
});
