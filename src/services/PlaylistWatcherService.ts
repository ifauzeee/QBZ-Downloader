import QobuzAPI from '../api/qobuz.js';
import { databaseService } from './database/index.js';
import { downloadQueue } from './queue/queue.js';
import { logger } from '../utils/logger.js';
import { historyService } from './history.js';

export class PlaylistWatcherService {
    private api: QobuzAPI;
    private timer: NodeJS.Timeout | null = null;
    private isScanning = false;

    constructor(api: QobuzAPI) {
        this.api = api;
    }

    start(checkIntervalMinutes = 60) {
        if (this.timer) return;

        this.timer = setInterval(() => {
            this.scanAllPlaylists();
        }, checkIntervalMinutes * 60 * 1000);

        this.scanAllPlaylists();
        logger.info(`PlaylistWatcher: Started (checking every ${checkIntervalMinutes} mins)`, 'WATCHER');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    async scanAllPlaylists() {
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            const watched = databaseService.getWatchedPlaylists();
            logger.debug(`PlaylistWatcher: Scanning ${watched.length} playlists`, 'WATCHER');

            for (const playlist of watched) {
                await this.scanPlaylist(playlist);
            }
        } catch (error: any) {
            logger.error(`PlaylistWatcher Scan Error: ${error.message}`, 'WATCHER');
        } finally {
            this.isScanning = false;
        }
    }

    private async scanPlaylist(p: any) {
        const lastSync = p.last_synced_at ? new Date(p.last_synced_at) : new Date(0);
        const nextSync = new Date(lastSync.getTime() + p.interval_hours * 60 * 60 * 1000);

        if (nextSync > new Date()) {
            return;
        }

        logger.info(`PlaylistWatcher: Checking "${p.title}" for new tracks...`, 'WATCHER');

        try {
            const res = await this.api.getPlaylist(p.playlist_id);
            if (!res.success || !res.data) {
                logger.warn(`PlaylistWatcher: Could not fetch playlist ${p.playlist_id}`, 'WATCHER');
                return;
            }

            const tracks = res.data.tracks.items;
            let newTracksCount = 0;

            for (const track of tracks) {
                const trackId = track.id.toString();
                const inHistory = historyService.has(trackId);
                const inDb = databaseService.hasTrack(trackId);
                const inQueue = downloadQueue.hasContent('track', trackId);

                if (!inHistory && !inDb && !inQueue) {
                    downloadQueue.add('track', trackId, p.quality || 27, {
                        title: track.title,
                        metadata: { source: 'playlist-watcher', playlistTitle: p.title }
                    });
                    newTracksCount++;
                }
            }

            if (newTracksCount > 0) {
                logger.success(`PlaylistWatcher: Added ${newTracksCount} new tracks from "${p.title}"`, 'WATCHER');
            }

            databaseService.updatePlaylistSyncTime(p.id);

        } catch (error: any) {
            logger.error(`PlaylistWatcher: Error scanning "${p.title}": ${error.message}`, 'WATCHER');
        }
    }
}

export const playlistWatcherService = new PlaylistWatcherService(new QobuzAPI());
