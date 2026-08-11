import axios from 'axios';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/** These calls sit on the download completion path; without a bound a
 *  unresponsive media server stalls the whole pipeline. */
const NOTIFY_TIMEOUT_MS = 10000;

/** Reject anything that is not plain HTTP(S) before it reaches axios, so a
 *  media-server URL cannot become a file:// or other protocol handler read. */
function assertHttpUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error('Media server URL is not a valid URL');
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Media server URL must use http or https');
    }
}

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
            assertHttpUrl(url);

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
        // Plex authenticates by token; keep it in a header rather than the
        // query string so it does not land in the server's access log.
        const endpoint = `${url}/library/sections/${encodeURIComponent(section)}/refresh`;
        await axios.get(endpoint, {
            timeout: NOTIFY_TIMEOUT_MS,
            headers: { 'X-Plex-Token': token }
        });
        logger.success('MediaServer: Plex library scan triggered.', 'MEDIA');
    }

    private async notifyJellyfin(url: string, token: string) {
        const endpoint = `${url}/Library/Refresh`;
        await axios.post(endpoint, undefined, {
            timeout: NOTIFY_TIMEOUT_MS,
            headers: { 'X-Emby-Token': token }
        });
        logger.success('MediaServer: Jellyfin library scan triggered.', 'MEDIA');
    }

    private async notifyWebhook(url: string, data: { title: string; artist: string; album: string; type: string }) {
        await axios.post(
            url,
            {
                event: 'download_complete',
                timestamp: new Date().toISOString(),
                payload: data
            },
            { timeout: NOTIFY_TIMEOUT_MS }
        );
        logger.success('MediaServer: Webhook notification sent.', 'MEDIA');
    }

    async testConnection(type: string, url: string, token: string, _libraryId?: string) {
        if (!url) throw new Error('URL is required');
        assertHttpUrl(url);

        try {
            switch (type) {
                case 'plex': {
                    const plexEndpoint = `${url}/identity`;
                    await axios.get(plexEndpoint, {
                        timeout: 5000,
                        headers: { 'X-Plex-Token': token }
                    });
                    return { success: true, message: 'Connected to Plex successfully' };
                }
                case 'jellyfin': {
                    const jellyEndpoint = `${url}/System/Info`;
                    await axios.get(jellyEndpoint, {
                        timeout: 5000,
                        headers: { 'X-Emby-Token': token }
                    });
                    return { success: true, message: 'Connected to Jellyfin successfully' };
                }
                case 'webhook':
                    await axios.post(url, { event: 'ping', timestamp: new Date().toISOString() }, { timeout: 5000 });
                    return { success: true, message: 'Webhook test ping successful' };
                default:
                    throw new Error('Invalid media server type');
            }
        } catch (error: unknown) {
            let msg = String(error);
            if (axios.isAxiosError(error)) {
                msg = error.response?.data?.message || error.message;
            }
            throw new Error(`Connection failed: ${msg}`);
        }
    }
}

export const mediaServerService = new MediaServerService();
