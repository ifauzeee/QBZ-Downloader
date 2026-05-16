import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlaylistWatcherService } from './PlaylistWatcherService.js';
import QobuzAPI from '../api/qobuz.js';
import { databaseService } from './database/index.js';
import { downloadQueue } from './queue/queue.js';
import { historyService } from './history.js';
import { notificationService } from './notifications.js';

// Mock dependencies
vi.mock('../api/qobuz.js', () => {
    const mockApi = {
        getPlaylist: vi.fn().mockResolvedValue({
            success: true,
            data: {
                tracks: {
                    items: [
                        { id: 'new1', title: 'New Track 1' },
                        { id: 'old1', title: 'Old Track 1' }
                    ]
                }
            }
        }),
        getTrack: vi.fn(),
        getAlbum: vi.fn(),
        getArtist: vi.fn()
    };
    return {
        qobuzApi: mockApi,
        default: mockApi
    };
});

import qobuzApi from '../api/qobuz.js';

vi.mock('./database/index.js', () => ({
    databaseService: {
        getWatchedPlaylists: vi.fn().mockReturnValue([]),
        hasTrack: vi.fn().mockReturnValue(false),
        updatePlaylistSyncTime: vi.fn()
    }
}));

vi.mock('./queue/queue.js', () => ({
    downloadQueue: {
        hasContent: vi.fn().mockReturnValue(false),
        add: vi.fn()
    }
}));

vi.mock('./history.js', () => ({
    historyService: {
        has: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('./notifications.js', () => ({
    notificationService: {
        info: vi.fn()
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

describe('PlaylistWatcherService', () => {
    let service: PlaylistWatcherService;
    let mockApi: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApi = qobuzApi;
        service = new PlaylistWatcherService(mockApi);
    });

    describe('Timer Control', () => {
        it('should start and stop timer', () => {
            vi.useFakeTimers();
            service.start(60);
            expect(vi.getTimerCount()).toBe(1);
            service.stop();
            expect(vi.getTimerCount()).toBe(0);
            vi.useRealTimers();
        });
    });

    describe('Scanning Logic', () => {
        it('should skip scanning if already in progress', async () => {
            (service as any).isScanning = true;
            await service.scanAllPlaylists();
            expect(databaseService.getWatchedPlaylists).not.toHaveBeenCalled();
        });

        it('should check for new tracks and add to queue', async () => {
            const mockPlaylist = {
                id: 1,
                playlist_id: 'pl1',
                title: 'Test Playlist',
                interval_hours: 1,
                quality: 27,
                last_synced_at: '2020-01-01' // Very old
            };
            vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([mockPlaylist]);
            
            // Mock track deduplication: new1 is new, old1 is in history
            vi.mocked(historyService.has).mockImplementation((id) => id === 'old1');

            await service.scanAllPlaylists();

            expect(mockApi.getPlaylist).toHaveBeenCalledWith('pl1');
            expect(downloadQueue.add).toHaveBeenCalledTimes(1);
            expect(downloadQueue.add).toHaveBeenCalledWith(
                'track', 
                'new1', 
                expect.any(Number), 
                expect.objectContaining({ title: 'New Track 1' })
            );
            expect(databaseService.updatePlaylistSyncTime).toHaveBeenCalledWith('1');
            expect(notificationService.info).toHaveBeenCalled();
        });

        it('should respect sync interval', async () => {
            const now = new Date();
            const mockPlaylist = {
                id: 1,
                playlist_id: 'pl1',
                title: 'Test Playlist',
                interval_hours: 24,
                quality: 27,
                last_synced_at: now.toISOString() // Just synced
            };
            vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([mockPlaylist]);

            await service.scanAllPlaylists();

            expect(mockApi.getPlaylist).not.toHaveBeenCalled();
        });
    });
});
