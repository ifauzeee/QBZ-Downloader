import axios from 'axios';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

export class MediaServerService {
    async notifyNewContent(data: {
        title: string;
        artist: string;
        album: string;
        type: 'track' | 'album' | 'playlist';
        filePath?: string;
    }) {
        const { enabled, type, url, token, libraryId } = CONFIG.mediaServer;

        if (!enabled || type === 'none' || !url) {
            return;
        }

        logger.info(`MediaServer: Notifying ${type} about new content: ${data.title}`, 'MEDIA');

        try {
            switch (type) {
                case 'plex':
                    await this.notifyPlex(url, token, libraryId);
                    break;
                case 'jellyfin':
                    await this.notifyJellyfin(url, token);
                    break;
                case 'webhook':
                    await this.notifyWebhook(url, data);
                    break;
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`MediaServer Notification Failed (${type}): ${message}`, 'MEDIA');
        }
    }

    private async notifyPlex(url: string, token: string, libraryId?: string) {
        const section = libraryId || 'all';
        const endpoint = `${url}/library/sections/${section}/refresh?X-Plex-Token=${token}`;
        await axios.get(endpoint);
        logger.success('MediaServer: Plex library scan triggered.', 'MEDIA');
    }

    private async notifyJellyfin(url: string, token: string) {
        const endpoint = `${url}/Library/Refresh?api_key=${token}`;
        await axios.post(endpoint);
        logger.success('MediaServer: Jellyfin library scan triggered.', 'MEDIA');
    }

    private async notifyWebhook(url: string, data: any) {
        await axios.post(url, {
            event: 'download_complete',
            timestamp: new Date().toISOString(),
            payload: data
        });
        logger.success('MediaServer: Webhook notification sent.', 'MEDIA');
    }

    async testConnection(type: string, url: string, token: string, _libraryId?: string) {
        if (!url) throw new Error('URL is required');

        try {
            switch (type) {
                case 'plex': {
                    const plexEndpoint = `${url}/identity?X-Plex-Token=${token}`;
                    await axios.get(plexEndpoint, { timeout: 5000 });
                    return { success: true, message: 'Connected to Plex successfully' };
                }
                case 'jellyfin': {
                    const jellyEndpoint = `${url}/System/Info?api_key=${token}`;
                    await axios.get(jellyEndpoint, { timeout: 5000 });
                    return { success: true, message: 'Connected to Jellyfin successfully' };
                }
                case 'webhook':
                    await axios.post(url, { event: 'ping', timestamp: new Date().toISOString() }, { timeout: 5000 });
                    return { success: true, message: 'Webhook test ping successful' };
                default:
                    throw new Error('Invalid media server type');
            }
        } catch (error: unknown) {
            const err = error as any;
            const msg = err.response?.data?.message || err.message || String(error);
            throw new Error(`Connection failed: ${msg}`);
        }
    }
}

export const mediaServerService = new MediaServerService();
