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

describe('QobuzAPI getFileUrl format_id=1 handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGet.mockReset();
    });

    it('should return early with format_id=1 for genuine preview (sample=true)', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/preview.flac',
                format_id: 1,
                sample: true,
                duration: 30,
                bit_depth: 24,
                sampling_rate: 96,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-1', 27);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.format_id).toBe(1);
        expect(result.data.quality_verified).toBe(false);
        expect(result.data.sample).toBe(true);
    });

    it('should return early with format_id=1 for genuine preview (duration=30)', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/preview.flac',
                format_id: 1,
                sample: false,
                duration: 30,
                bit_depth: 24,
                sampling_rate: 96,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-2', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(1);
        expect(result.data.quality_verified).toBe(false);
    });

    it('should return early with format_id=1 for genuine preview (duration=15)', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/preview.flac',
                format_id: 1,
                sample: false,
                duration: 15,
                bit_depth: 24,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-3', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(1);
        expect(result.data.quality_verified).toBe(false);
    });

    it('should fall through to quality detection for false positive format_id=1 with 24-bit/96kHz', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.flac',
                format_id: 1,
                sample: false,
                duration: 300,
                bit_depth: 24,
                sampling_rate: 96,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-4', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(7);
        expect(result.data.quality_verified).toBe(true);
    });

    it('should fall through to quality detection for false positive format_id=1 with 24-bit/192kHz', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.flac',
                format_id: 1,
                sample: false,
                duration: 450,
                bit_depth: 24,
                sampling_rate: 192,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-5', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(27);
        expect(result.data.quality_verified).toBe(true);
    });

    it('should detect format from bit_depth=16 even when format_id=1', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.flac',
                format_id: 1,
                sample: false,
                duration: 240,
                bit_depth: 16,
                sampling_rate: 44.1,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-6', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(6);
        expect(result.data.quality_verified).toBe(true);
    });

    it('should detect MP3 format from mime_type even when format_id=1', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.mp3',
                format_id: 1,
                sample: false,
                duration: 200,
                mime_type: 'audio/mpeg'
            }
        });

        const result = await api.getFileUrl('track-7', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(5);
        expect(result.data.quality_verified).toBe(true);
    });

    it('should preserve format_id=27 for normal high-res track', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.flac',
                format_id: 27,
                sample: false,
                duration: 360,
                bit_depth: 24,
                sampling_rate: 192,
                mime_type: 'audio/flac'
            }
        });

        const result = await api.getFileUrl('track-8', 27);

        expect(result.success).toBe(true);
        expect(result.data.format_id).toBe(27);
        expect(result.data.quality_verified).toBe(true);
    });

    it('should stay format_id=1 for false positive with no quality metadata', async () => {
        const api = new QobuzAPI();
        mockGet.mockResolvedValue({
            data: {
                url: 'https://example.test/track.flac',
                format_id: 1,
                sample: false,
                duration: 300
            }
        });

        const result = await api.getFileUrl('track-9', 27);

        expect(result.success).toBe(true);
        // Falls through but no bit_depth/mime_type to determine quality → stays 1
        expect(result.data.format_id).toBe(1);
        // qualityVerified starts as true because rawFormatId > 0
        // downloadTrack safety net rejects via format_id === 1 check
    });
});
