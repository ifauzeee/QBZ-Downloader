import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigBackupService } from './ConfigBackupService.js';
import { settingsService } from './settings.js';
import { databaseService } from './database/index.js';
import { downloadQueue } from './queue/queue.js';

vi.mock('./settings.js', () => ({
    settingsService: {
        getAll: vi.fn(),
        setMany: vi.fn()
    }
}));

vi.mock('./database/index.js', () => ({
    databaseService: {
        getWatchedPlaylists: vi.fn(),
        getQueueItems: vi.fn(),
        upsertWatchedPlaylist: vi.fn(),
        addQueueItem: vi.fn(),
        clearWatchedPlaylists: vi.fn(),
        clearQueueItems: vi.fn()
    }
}));

vi.mock('./queue/queue.js', () => ({
    downloadQueue: {
        clear: vi.fn(),
        load: vi.fn().mockResolvedValue(undefined)
    }
}));

describe('ConfigBackupService', () => {
    let service: ConfigBackupService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ConfigBackupService();
        vi.mocked(settingsService.getAll).mockReturnValue({
            UI_LANGUAGE: 'id',
            QOBUZ_APP_ID: 'app-id'
        });
        vi.mocked(databaseService.getWatchedPlaylists).mockReturnValue([
            {
                id: 'watch-1',
                playlist_id: 'pl-1',
                title: 'Watch',
                quality: 27,
                interval_hours: 24
            }
        ]);
        vi.mocked(databaseService.getQueueItems).mockReturnValue([
            {
                id: 'queue-1',
                type: 'track',
                contentId: 'track-1',
                quality: 27,
                status: 'pending',
                priority: 'normal',
                progress: 0,
                addedAt: new Date('2026-05-25T00:00:00.000Z'),
                retryCount: 0,
                maxRetries: 3
            }
        ]);
    });

    it('should export and import an encrypted configuration backup', async () => {
        const backup = service.exportEncrypted('strong-passphrase');

        expect(backup.format).toBe('qbz-config-backup');
        expect(JSON.stringify(backup)).not.toContain('app-id');

        const result = await service.importEncrypted(backup, 'strong-passphrase');

        expect(result).toEqual({
            settings: 2,
            watchedPlaylists: 1,
            queueItems: 1
        });
        expect(settingsService.setMany).toHaveBeenCalledWith(
            expect.objectContaining({ UI_LANGUAGE: 'id', QOBUZ_APP_ID: 'app-id' })
        );
        expect(databaseService.upsertWatchedPlaylist).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'watch-1', playlistId: 'pl-1' })
        );
        expect(databaseService.addQueueItem).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'queue-1', contentId: 'track-1' })
        );
        expect(downloadQueue.load).toHaveBeenCalled();
    });

    it('should clear existing watched playlists and queue when replacing', async () => {
        const backup = service.exportEncrypted('strong-passphrase');

        await service.importEncrypted(backup, 'strong-passphrase', 'replace');

        expect(databaseService.clearWatchedPlaylists).toHaveBeenCalled();
        expect(downloadQueue.clear).toHaveBeenCalled();
        expect(databaseService.clearQueueItems).toHaveBeenCalled();
    });

    it('should reject weak passphrases', () => {
        expect(() => service.exportEncrypted('short')).toThrow('at least 8 characters');
    });
});
