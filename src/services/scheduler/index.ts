import cron from 'node-cron';
import { db } from '../database.js';
import { logger } from '../../utils/logger.js';
import QobuzAPI from '../../api/qobuz.js';
import { downloadQueue } from '../telegram/queue.js';

export class SchedulerService {
    private tasks: cron.ScheduledTask[] = [];
    private api: QobuzAPI;

    constructor() {
        this.api = new QobuzAPI();
    }

    start() {
        this.tasks.push(
            cron.schedule('0 * * * *', () => {
                this.syncPlaylists();
            })
        );
        logger.info('Scheduler started: Playlist Sync (Hourly)');
        this.syncPlaylists();
    }

    async syncPlaylists() {
        logger.debug('Scheduler: Checking tracked playlists...');
        const playlists = db.getWatchedPlaylists();

        for (const playlist of playlists) {
            const lastSynced = playlist.lastSyncedAt ? new Date(playlist.lastSyncedAt) : new Date(0);
            const now = new Date();
            const diffHours = (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60);

            if (diffHours >= playlist.intervalHours) {
                await this.processPlaylist(playlist);
            }
        }
    }

    private async processPlaylist(playlist: any) {
        logger.info(`Scheduler: Syncing playlist "${playlist.title}" (${playlist.playlistId})`);

        try {
            const result = await this.api.getPlaylist(playlist.playlistId);

            if (!result.success || !result.data) {
                logger.warn(`Scheduler: Failed to fetch playlist ${playlist.playlistId}`);
                return;
            }

            const tracks = result.data.tracks;
            if (!tracks || !tracks.items) {
                logger.warn(`Scheduler: No tracks found in playlist ${playlist.playlistId}`);
                return;
            }

            let addedCount = 0;
            const history = db.getAllHistory();

            for (const track of tracks.items) {
                const isDownloaded = history.some((h: any) => h.id.toString() === track.id.toString());
                const isInQueue = downloadQueue.hasContent('track', track.id);

                if (!isDownloaded && !isInQueue) {
                    downloadQueue.add('track', track.id, playlist.quality, {
                        title: track.title,
                        metadata: { source: 'scheduler', playlistId: playlist.playlistId }
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                logger.success(`Scheduler: Added ${addedCount} new tracks from "${playlist.title}"`);
            } else {
                logger.debug(`Scheduler: No new tracks in "${playlist.title}"`);
            }

            db.updatePlaylistLastSynced(playlist.id);

        } catch (error) {
            logger.error(`Scheduler: Error syncing playlist ${playlist.id}: ${error}`);
        }
    }

    stop() {
        this.tasks.forEach(t => t.stop());
        logger.info('Scheduler stopped');
    }
}

export const schedulerService = new SchedulerService();
