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
        } catch (error: any) {
            logger.error(`MediaServer Notification Failed (${type}): ${error.message}`, 'MEDIA');
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
}

export const mediaServerService = new MediaServerService();
