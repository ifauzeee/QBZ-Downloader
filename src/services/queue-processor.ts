import { downloadQueue } from './telegram/queue.js';
import DownloadService from './download.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from './metadata.js';
import { logger } from '../utils/logger.js';
import { QueueItem } from './telegram/types.js';

export class QueueProcessor {
    private api: QobuzAPI;
    private downloadService: DownloadService;
    private isProcessing: boolean = false;

    constructor() {
        this.api = new QobuzAPI();
        const lyricsProvider = new LyricsProvider();
        const metadataService = new MetadataService();
        this.downloadService = new DownloadService(this.api, lyricsProvider, metadataService);
    }

    start(): void {
        this.setupEvents();
        logger.info('Queue Processor started (Headless Mode)');
    }

    private setupEvents(): void {
        downloadQueue.on('item:added', () => this.processNext());
        downloadQueue.on('item:completed', () => this.processNext());
        downloadQueue.on('item:failed', () => this.processNext());
    }

    private async processNext(): Promise<void> {
        if (this.isProcessing && downloadQueue.isProcessing()) return;

        const item = downloadQueue.getNext();
        if (!item) return;

        this.isProcessing = true;
        downloadQueue.startItem(item.id);

        try {
            if (item.type === 'track') {
                await this.processTrack(item);
            } else {
                await this.processBatch(item);
            }
        } catch (error: any) {
            logger.error(`Processor Error: ${error.message}`);
            downloadQueue.fail(item.id, error.message);
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }

    private async processTrack(item: QueueItem): Promise<void> {
        const result = await this.downloadService.downloadTrack(item.contentId, item.quality, {
            onProgress: (progress) => {
                const pct =
                    progress.phase === 'download' && progress.total
                        ? Math.floor((progress.loaded / progress.total) * 100)
                        : progress.phase === 'tagging'
                          ? 99
                          : 0;

                downloadQueue.updateProgress(
                    item.id,
                    pct,
                    progress.phase === 'tagging' ? 'processing' : 'downloading'
                );
            }
        });

        if (result.success && result.filePath) {
            downloadQueue.complete(item.id, result.filePath);
            logger.success(`Downloaded: ${item.title}`);
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    }

    private async processBatch(item: QueueItem): Promise<void> {
        const id = item.contentId;
        const type = item.type;

        let result;
        const opts = { onProgress: () => {} };

        if (type === 'album') {
            result = await this.downloadService.downloadAlbum(id, item.quality, opts);
        } else if (type === 'playlist') {
            result = await this.downloadService.downloadPlaylist(id, item.quality, opts);
        } else {
            await this.downloadService.downloadArtist(id, item.quality);
            result = { success: true };
        }

        if (result.success) {
            downloadQueue.complete(item.id);
            logger.success(`Batch Downloaded: ${item.title}`);
        } else {
            throw new Error(result.error || 'Batch download failed');
        }
    }
}

export const queueProcessor = new QueueProcessor();
