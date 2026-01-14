import { Telegraf } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { CONFIG, getQualityName } from '../../../config.js';
import QobuzAPI from '../../../api/qobuz.js';
import DownloadService, { DownloadProgress } from '../../download.js';
import { logger } from '../../../utils/logger.js';

import { DownloadQueue, downloadQueue } from '../queue.js';
import { DownloadType, QueueItem } from '../types.js';
import { escapeHtml, formatSize } from '../utils.js';
import {
    buildDownloadStartMessage,
    buildDownloadCompleteMessage,
    buildProgressMessage,
    buildBatchInitMessage,
    buildBatchUploadMessage,
    buildFileTooLargeMessage,
    buildQueuedMessage,
    buildErrorMessage
} from '../messages.js';

export class DownloadHandler {
    private bot: Telegraf;
    private chatId: string;
    private api: QobuzAPI;
    private downloadService: DownloadService;
    private uploadEnabled: boolean;
    private lastProgressUpdate: number = 0;
    private progressUpdateInterval: number = 2000;
    private isQueueProcessing: boolean = false;

    constructor(
        bot: Telegraf,
        chatId: string,
        api: QobuzAPI,
        downloadService: DownloadService,
        uploadEnabled: boolean = true
    ) {
        this.bot = bot;
        this.chatId = chatId;
        this.api = api;
        this.downloadService = downloadService;
        this.uploadEnabled = uploadEnabled;

        this.setupQueueEvents();
    }

    private setupQueueEvents(): void {
        downloadQueue.on('item:added', (item) => {
            logger.debug(`Queue event: item added ${item.id}`);
            this.processNextInQueue();
        });

        downloadQueue.on('item:completed', () => {
            this.processNextInQueue();
        });

        downloadQueue.on('item:failed', () => {
            this.processNextInQueue();
        });

        downloadQueue.on('queue:empty', () => {
            logger.info('Queue: All downloads completed');
            this.isQueueProcessing = false;
        });
    }

    private async processNextInQueue(): Promise<void> {
        if (this.isQueueProcessing && downloadQueue.isProcessing()) {
            return;
        }

        const nextItem = downloadQueue.getNext();
        if (!nextItem) return;

        this.isQueueProcessing = true;
        downloadQueue.startItem(nextItem.id);

        try {
            if (nextItem.type === 'track') {
                await this.processTrackDownload(nextItem);
            } else {
                await this.processBatchDownload(nextItem);
            }
        } catch (error: any) {
            downloadQueue.fail(nextItem.id, error.message);
            await this.sendError('Download Error', error.message);
        }
    }

    async queueDownload(
        id: string | number,
        type: DownloadType,
        quality: number,
        title?: string
    ): Promise<QueueItem> {
        if (downloadQueue.hasContent(type, id)) {
            throw new Error('This item is already in the queue');
        }

        const item = downloadQueue.add(type, id, quality, { title });
        const position = downloadQueue.getPosition(item.id);

        await this.sendMessage(buildQueuedMessage(title || `${type} #${id}`, type, position));

        return item;
    }

    private async processTrackDownload(item: QueueItem): Promise<void> {
        const quality = item.quality;
        const id = item.contentId;

        const info = await this.api.getTrack(id);
        if (!info.success || !info.data) {
            throw new Error('Track not found');
        }

        const title = info.data.title;
        item.title = title;
        const isDashboard = item.metadata?.source === 'dashboard';

        let messageId: number | undefined;
        if (!isDashboard) {
            const progressMsg = await this.bot.telegram.sendMessage(
                this.chatId,
                `<b>${escapeHtml(title)}</b>\n\n⏳ Initializing...`,
                { parse_mode: 'HTML' }
            );
            messageId = progressMsg.message_id;
        }

        const result = await this.downloadService.downloadTrack(id, quality, {
            onProgress: (progress) => {
                if (!isDashboard && messageId) this.updateProgressMessage(messageId, progress, title);
                downloadQueue.updateProgress(
                    item.id,
                    progress.phase === 'download' && progress.total
                        ? Math.floor((progress.loaded / progress.total) * 100)
                        : 50,
                    progress.phase === 'tagging' ? 'processing' : 'downloading'
                );
            }
        });

        if (!isDashboard && messageId) {
            try {
                await this.bot.telegram.deleteMessage(this.chatId, messageId);
            } catch { }
        }

        if (result.success && result.filePath) {
            downloadQueue.complete(item.id, result.filePath);

            if (!isDashboard) {
                const uploadMsg = await this.bot.telegram.sendMessage(
                    this.chatId,
                    buildBatchUploadMessage(title, 'track'),
                    { parse_mode: 'HTML' }
                );

                await this.sendMessage(
                    buildDownloadCompleteMessage(
                        title,
                        result.filePath,
                        { totalSize: 0 },
                        !(CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete)
                    )
                );

                await this.uploadFile(result.filePath);

                try {
                    await this.bot.telegram.deleteMessage(this.chatId, uploadMsg.message_id);
                } catch { }
            }
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    }

    private async processBatchDownload(item: QueueItem): Promise<void> {
        const quality = item.quality;
        const id = item.contentId;
        const type = item.type as 'album' | 'playlist' | 'artist';

        if (type === 'album') {
            await this.downloadAlbum(item, id, quality);
        } else if (type === 'playlist') {
            await this.downloadPlaylist(item, id, quality);
        } else if (type === 'artist') {
            await this.downloadArtist(id, quality);
        }
    }

    private async downloadAlbum(
        item: QueueItem,
        id: string | number,
        quality: number
    ): Promise<void> {
        const info = await this.api.getAlbum(id);
        if (!info.success || !info.data) {
            throw new Error('Album not found');
        }

        const title = info.data.title;
        item.title = title;
        const isDashboard = item.metadata?.source === 'dashboard';

        let messageId: number | undefined;
        if (!isDashboard) {
            await this.sendMessage(buildDownloadStartMessage(title, 'album', getQualityName(quality)));

            const progressMsg = await this.bot.telegram.sendMessage(
                this.chatId,
                buildBatchInitMessage(title, 'album'),
                { parse_mode: 'HTML' }
            );
            messageId = progressMsg.message_id;
        }

        const result = await this.downloadService.downloadAlbum(id, quality, {
            onProgress: () => { }
        });

        if (!isDashboard && messageId) {
            try {
                await this.bot.telegram.deleteMessage(this.chatId, messageId);
            } catch { }
        }

        const albumPath = result.tracks?.[0]?.filePath
            ? path.dirname(result.tracks[0].filePath)
            : 'Album Directory';

        if (result.success || (result.tracks && result.tracks.some((t) => t.success))) {
            downloadQueue.complete(item.id, albumPath);

            if (!isDashboard) {
                const uploadMsg = await this.bot.telegram.sendMessage(
                    this.chatId,
                    buildBatchUploadMessage(title, 'album'),
                    { parse_mode: 'HTML' }
                );

                await this.sendMessage(
                    buildDownloadCompleteMessage(
                        title,
                        albumPath,
                        { trackCount: result.totalTracks },
                        !(CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete)
                    )
                );


                if (!result.success) {
                    await this.sendMessage(
                        `⚠️ Some tracks failed to download (${result.failedTracks}/${result.totalTracks})`
                    );
                }

                if (result.tracks) {
                    for (const trackRes of result.tracks) {
                        if (trackRes.success && trackRes.filePath) {
                            await this.uploadFile(trackRes.filePath);
                        }
                    }
                }

                try {
                    await this.bot.telegram.deleteMessage(this.chatId, uploadMsg.message_id);
                } catch { }
            }
        } else {
            throw new Error(result.error || `All ${result.totalTracks} tracks failed to download.`);
        }
    }

    private async downloadPlaylist(
        item: QueueItem,
        id: string | number,
        quality: number
    ): Promise<void> {
        const info = await this.api.getPlaylist(id);
        if (!info.success || !info.data) {
            throw new Error('Playlist not found');
        }

        const title = info.data.name;
        item.title = title;

        await this.sendMessage(
            buildDownloadStartMessage(title, 'playlist', getQualityName(quality))
        );

        const progressMsg = await this.bot.telegram.sendMessage(
            this.chatId,
            buildBatchInitMessage(title, 'playlist'),
            { parse_mode: 'HTML' }
        );
        const messageId = progressMsg.message_id;

        const result = await this.downloadService.downloadPlaylist(id, quality, {
            onProgress: () => { }
        });

        try {
            await this.bot.telegram.deleteMessage(this.chatId, messageId);
        } catch { }

        if (result.success || (result.tracks && result.tracks.some((t) => t.success))) {
            downloadQueue.complete(item.id);

            const uploadMsg = await this.bot.telegram.sendMessage(
                this.chatId,
                buildBatchUploadMessage(title, 'playlist'),
                { parse_mode: 'HTML' }
            );

            await this.sendMessage(
                buildDownloadCompleteMessage(
                    title,
                    'Playlist Directory',
                    { trackCount: result.totalTracks },
                    !(CONFIG.telegram.uploadFiles && CONFIG.telegram.autoDelete)
                )
            );

            if (!result.success) {
                await this.sendMessage(
                    `⚠️ Some tracks failed to download (${result.failedTracks}/${result.totalTracks})`
                );
            }

            if (result.tracks) {
                for (const trackRes of result.tracks) {
                    if (trackRes.success && trackRes.filePath) {
                        await this.uploadFile(trackRes.filePath);
                    }
                }
            }

            try {
                await this.bot.telegram.deleteMessage(this.chatId, uploadMsg.message_id);
            } catch { }
        } else {
            throw new Error(result.error || `All ${result.totalTracks} tracks failed to download.`);
        }
    }

    private async downloadArtist(id: string | number, quality: number): Promise<void> {
        await this.downloadService.downloadArtist(id, quality);
    }

    private async updateProgressMessage(
        messageId: number,
        progress: DownloadProgress,
        title: string
    ): Promise<void> {
        const now = Date.now();
        if (
            now - this.lastProgressUpdate < this.progressUpdateInterval &&
            progress.loaded !== progress.total &&
            progress.phase !== 'tagging'
        ) {
            return;
        }
        this.lastProgressUpdate = now;

        const msgCode = buildProgressMessage(
            title,
            progress.phase,
            progress.loaded,
            progress.total
        );

        try {
            await this.bot.telegram.editMessageText(this.chatId, messageId, undefined, msgCode, {
                parse_mode: 'HTML'
            });
        } catch { }
    }

    async uploadFile(filePath: string, caption?: string): Promise<void> {
        if (!this.uploadEnabled) return;

        try {
            const stats = fs.statSync(filePath);
            const fileSizeInBytes = stats.size;
            const sizeInMB = fileSizeInBytes / (1024 * 1024);

            if (sizeInMB > 49) {
                await this.sendMessage(
                    buildFileTooLargeMessage(path.basename(filePath), fileSizeInBytes)
                );
                return;
            }

            logger.info(
                `Uploading to Telegram: ${path.basename(filePath)} (${formatSize(fileSizeInBytes)})`
            );

            await this.bot.telegram.sendAudio(
                this.chatId,
                { source: filePath },
                { caption: caption || path.basename(filePath) }
            );

            logger.success(`Upload complete: ${path.basename(filePath)}`);

            if (CONFIG.telegram.autoDelete) {
                try {
                    fs.unlinkSync(filePath);
                    logger.debug(`Local file deleted (Auto-clean): ${path.basename(filePath)}`);
                    this.deleteEmptyDirs(path.dirname(filePath));
                } catch (delErr) {
                    logger.warn(`Failed to delete local file: ${delErr}`);
                }
            }
        } catch (error) {
            logger.error(`Failed to upload file to Telegram: ${error}`);
            await this.sendError(
                'Upload Failed',
                `Could not upload ${path.basename(filePath)}. File kept locally.`
            );
        }
    }

    private deleteEmptyDirs(dir: string): void {
        if (!dir || dir === CONFIG.download.outputDir) return;
        try {
            const files = fs.readdirSync(dir);
            if (files.length === 0) {
                fs.rmdirSync(dir);
                logger.debug(`Cleaned up empty directory: ${path.basename(dir)}`);
                this.deleteEmptyDirs(path.dirname(dir));
            }
        } catch { }
    }

    async sendMessage(message: string): Promise<void> {
        try {
            await this.bot.telegram.sendMessage(this.chatId, message, {
                parse_mode: 'HTML'
            });
        } catch (error) {
            logger.error(`Failed to send message: ${error}`);
        }
    }

    async sendError(context: string, error: string): Promise<void> {
        logger.error(`${context}: ${error}`);
        await this.sendMessage(buildErrorMessage(context, error));
    }

    resolveQuality(quality: number | 'ask' | 'min' | 'max'): number {
        if (typeof quality === 'number') return quality;
        if (quality === 'min') return 5;
        return 27;
    }

    getQueue(): DownloadQueue {
        return downloadQueue;
    }
}
