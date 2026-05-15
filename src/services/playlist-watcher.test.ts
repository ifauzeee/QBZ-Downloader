import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlaylistWatcherService } from './PlaylistWatcherService.js';
import { databaseService } from './database/index.js';
import { downloadQueue } from './queue/queue.js';
import { historyService } from './history.js';
import { notificationService } from './notifications.js';

vi.mock('../api/qobuz.js', () => ({
    default: vi.fn().mockImplementation(function() {
        return {
            getPlaylist: vi.fn()
        };
    })
}));


vi.mock('./database/index.js', () => ({
    databaseService: {
        getWatchedPlaylists: vi.fn(),
        hasTrack: vi.fn(),
        updatePlaylistSyncTime: vi.fn()
    }
}));

vi.mock('./queue/queue.js', () => ({
    downloadQueue: {
        hasContent: vi.fn(),
        add: vi.fn()
    }
}));

vi.mock('./history.js', () => ({
    historyService: {
        has: vi.fn()
    }
}));

vi.mock('./notifications.js', () => ({
    notificationService: {
        info: vi.fn()
    }
}));

describe('PlaylistWatcherService', () => {
    let service: PlaylistWatcherService;
    let mockApi: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApi = {
            getPlaylist: vi.fn()
        };
        service = new PlaylistWatcherService(mockApi as any);
    });

    it('should add new tracks to queue if they are not in history/db/queue', async () => {
        const mockPlaylist = {
            id: 1,
            playlist_id: 'pl1',
            title: 'Test Playlist',
            interval_hours: 1,
            quality: 27,
            last_synced_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString() // 2 hours ago
        };

        vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([mockPlaylist]);
        mockApi.getPlaylist.mockResolvedValue({
            success: true,
            data: {
                tracks: {
                    items: [
                        { id: 't1', title: 'New Track' }
                    ]
                }
            }
        });

        vi.mocked(historyService.has).mockReturnValue(false);
        vi.mocked(databaseService.hasTrack).mockReturnValue(false);
        vi.mocked(downloadQueue.hasContent).mockReturnValue(false);

        await service.scanAllPlaylists();

        expect(downloadQueue.add).toHaveBeenCalledWith(
            'track',
            't1',
            27,
            expect.objectContaining({ title: 'New Track' })
        );
        expect(databaseService.updatePlaylistSyncTime).toHaveBeenCalledWith('1');
        expect(notificationService.info).toHaveBeenCalled();
    });

    it('should skip tracks that are already in history', async () => {
        const mockPlaylist = {
            id: 1,
            playlist_id: 'pl1',
            title: 'Test Playlist',
            interval_hours: 1,
            quality: 27,
            last_synced_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
        };

        vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([mockPlaylist]);
        mockApi.getPlaylist.mockResolvedValue({
            success: true,
            data: {
                tracks: {
                    items: [
                        { id: 't1', title: 'Old Track' }
                    ]
                }
            }
        });

        vi.mocked(historyService.has).mockReturnValue(true);

        await service.scanAllPlaylists();

        expect(downloadQueue.add).not.toHaveBeenCalled();
    });

    it('should skip playlist if not enough time has passed since last sync', async () => {
        const mockPlaylist = {
            id: 1,
            playlist_id: 'pl1',
            title: 'Test Playlist',
            interval_hours: 5,
            quality: 27,
            last_synced_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString() // 1 hour ago, but interval is 5
        };

        vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([mockPlaylist]);

        await service.scanAllPlaylists();

        expect(mockApi.getPlaylist).not.toHaveBeenCalled();
    });
});
