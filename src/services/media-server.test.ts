import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MediaServerService } from './MediaServerService.js';
import { settingsService } from './settings.js';
import axios from 'axios';

// Mock dependencies
vi.mock('axios');

vi.mock('./settings.js', () => ({
    settingsService: {
        get: vi.fn()
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

describe('MediaServerService', () => {
    let service: MediaServerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MediaServerService();
    });

    describe('Notifications', () => {
        it('should skip if disabled', async () => {
            vi.mocked(settingsService.get).mockReturnValue('false');
            await service.notifyNewContent({ title: 'T', artist: 'A', album: 'Alb', type: 'track' });
            expect(axios.post).not.toHaveBeenCalled();
        });

        it('should notify Plex', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'MEDIA_SERVER_ENABLED') return 'true';
                if (key === 'MEDIA_SERVER_TYPE') return 'plex';
                if (key === 'MEDIA_SERVER_URL') return 'http://plex';
                if (key === 'MEDIA_SERVER_TOKEN') return 'token123';
                return '';
            });

            await service.notifyNewContent({ title: 'T', artist: 'A', album: 'Alb', type: 'track' });
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('refresh'));
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('X-Plex-Token=token123'));
        });

        it('should notify Jellyfin', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'MEDIA_SERVER_ENABLED') return 'true';
                if (key === 'MEDIA_SERVER_TYPE') return 'jellyfin';
                if (key === 'MEDIA_SERVER_URL') return 'http://jellyfin';
                if (key === 'MEDIA_SERVER_TOKEN') return 'jkey';
                return '';
            });

            await service.notifyNewContent({ title: 'T', artist: 'A', album: 'Alb', type: 'track' });
            expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('Refresh?api_key=jkey'));
        });

        it('should notify Webhook', async () => {
            vi.mocked(settingsService.get).mockImplementation((key) => {
                if (key === 'MEDIA_SERVER_ENABLED') return 'true';
                if (key === 'MEDIA_SERVER_TYPE') return 'webhook';
                if (key === 'MEDIA_SERVER_URL') return 'http://hook';
                return '';
            });

            await service.notifyNewContent({ title: 'T', artist: 'A', album: 'Alb', type: 'track' });
            expect(axios.post).toHaveBeenCalledWith('http://hook', expect.objectContaining({
                event: 'download_complete'
            }));
        });
    });

    describe('Connection Testing', () => {
        it('should test Plex connection', async () => {
            vi.mocked(axios.get).mockResolvedValue({ data: {} });
            const result = await service.testConnection('plex', 'http://plex', 'token');
            expect(result.success).toBe(true);
            expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('identity'), expect.anything());

        });

        it('should handle connection failures', async () => {
            vi.mocked(axios.get).mockRejectedValue(new Error('Network error'));
            await expect(service.testConnection('plex', 'http://plex', 'token'))
                .rejects.toThrow('Connection failed:');

        });
    });
});
