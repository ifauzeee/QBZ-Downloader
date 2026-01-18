import { downloadQueue } from './queue/queue.js';
import DownloadService from './download.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from './metadata.js';
import { logger } from '../utils/logger.js';
import { QueueItem } from './queue/types.js';
import { CONFIG } from '../config.js';
import { notifyDownloadComplete, notifyDownloadError } from './notifications.js';

enum ErrorCategory {
    NETWORK = 'network',
    AUTH = 'auth',
    NOT_FOUND = 'not_found',
    RATE_LIMIT = 'rate_limit',
    SERVER = 'server',
    UNKNOWN = 'unknown'
}

interface NetworkError {
    message?: string;
    statusCode?: number;
    response?: { status?: number };
}

function categorizeError(error: unknown): ErrorCategory {
    const err = error as NetworkError;
    const message = (err?.message || '').toLowerCase();
    const statusCode = err?.statusCode || err?.response?.status || 0;

    if (statusCode === 401 || statusCode === 403 || message.includes('auth')) {
        return ErrorCategory.AUTH;
    }
    if (statusCode === 404 || message.includes('not found')) {
        return ErrorCategory.NOT_FOUND;
    }
    if (statusCode === 429 || message.includes('rate limit') || message.includes('too many')) {
        return ErrorCategory.RATE_LIMIT;
    }
    if (statusCode >= 500 || message.includes('server')) {
        return ErrorCategory.SERVER;
    }
    if (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('econnrefused')
    ) {
        return ErrorCategory.NETWORK;
    }
    return ErrorCategory.UNKNOWN;
}

function isRetryableError(category: ErrorCategory): boolean {
    return [
        ErrorCategory.NETWORK,
        ErrorCategory.RATE_LIMIT,
        ErrorCategory.SERVER,
        ErrorCategory.UNKNOWN
    ].includes(category);
}

function calculateRetryDelay(retryCount: number, category: ErrorCategory): number {
    const baseDelay = CONFIG.download.retryDelay || 1000;

    if (category === ErrorCategory.RATE_LIMIT) {
        return baseDelay * Math.pow(3, retryCount);
    }

    const delay = baseDelay * Math.pow(2, retryCount);
    const jitter = Math.random() * 500;
    return Math.min(delay + jitter, 30000);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class QueueProcessor {
    private api: QobuzAPI;
    private downloadService: DownloadService;
    private isProcessing: boolean = false;
    private lastErrorTime: number = 0;
    private consecutiveErrors: number = 0;
    private isHydrationRunning: boolean = false;

    constructor() {
        this.api = new QobuzAPI();
        const lyricsProvider = new LyricsProvider();
        const metadataService = new MetadataService();
        this.downloadService = new DownloadService(this.api, lyricsProvider, metadataService);
    }

    start(): void {
        this.setupEvents();
        this.startMetadataHydration();
        logger.info('Queue Processor active: Error Recovery & Smart Retry enabled', 'QUEUE');
    }

    private async startMetadataHydration(): Promise<void> {
        logger.info('Starting background metadata hydration service...', 'QUEUE');
        this.isHydrationRunning = true;
        while (this.isHydrationRunning) {
            try {
                const pendingItems = downloadQueue.getPendingItems();
                const itemsToHydrate = pendingItems.filter(
                    (item) => item.title === `${item.type}: ${item.contentId}`
                );

                for (const item of itemsToHydrate) {
                    try {
                        let title = item.title;
                        let artist = '';
                        let album = '';

                        if (item.type === 'track') {
                            const trackRes = await this.api.getTrack(item.contentId);
                            if (trackRes.success && trackRes.data) {
                                title = trackRes.data.title;
                                artist =
                                    trackRes.data.performer?.name ||
                                    trackRes.data.artist?.name ||
                                    '';
                                album = trackRes.data.album?.title || '';
                            }
                        } else if (item.type === 'album') {
                            const albumRes = await this.api.getAlbum(item.contentId);
                            if (albumRes.success && albumRes.data) {
                                title = albumRes.data.title;
                                artist = albumRes.data.artist?.name || '';
                            }
                        } else if (item.type === 'playlist') {
                            const plRes = await this.api.getPlaylist(item.contentId);
                            if (plRes.success && plRes.data) {
                                title = plRes.data.name;
                                artist = 'Various Artists';
                            }
                        } else if (item.type === 'artist') {
                            const artistRes = await this.api.getArtist(item.contentId);
                            if (artistRes.success && artistRes.data) {
                                title = (artistRes.data as any).name;
                            }
                        }

                        if (title !== item.title) {
                            downloadQueue.updateMetadata(item.id, { title, artist, album });
                            logger.debug(
                                `Hydrated metadata for ${item.type} ${item.contentId}: ${title}`,
                                'META'
                            );
                        }

                        await sleep(200);
                    } catch (e: any) {
                        logger.debug(
                            `Failed to hydrate metadata for ${item.contentId}: ${e.message}`
                        );
                    }
                }
            } catch (error) {
                logger.error(`Metadata hydration error: ${error}`, 'ERROR');
            }
            await sleep(5000);
        }
    }

    private setupEvents(): void {
        downloadQueue.on('item:added', () => this.processNext());
        downloadQueue.on('item:completed', () => {
            this.consecutiveErrors = 0;
            this.processNext();
        });
        downloadQueue.on('item:failed', () => this.processNext());
    }

    private async processNext(): Promise<void> {
        if (this.isProcessing && downloadQueue.isProcessing()) return;

        if (this.consecutiveErrors >= 5) {
            const timeSinceLastError = Date.now() - this.lastErrorTime;
            if (timeSinceLastError < 60000) {
                logger.warn(
                    `Circuit breaker active: ${this.consecutiveErrors} consecutive errors. Pausing execution...`,
                    'SYSTEM'
                );
                await sleep(30000);
                this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 2);
            } else {
                this.consecutiveErrors = 0;
            }
        }

        const item = downloadQueue.getNext();
        if (!item) return;

        this.isProcessing = true;
        downloadQueue.startItem(item.id);

        logger.info(`Processing item: ${item.title || item.contentId} (${item.type})`, 'QUEUE');

        try {
            if (item.type === 'track') {
                await this.processTrack(item);
            } else {
                await this.processBatch(item);
            }
            this.consecutiveErrors = 0;
        } catch (error: any) {
            await this.handleError(item, error);
        } finally {
            this.isProcessing = false;
            this.processNext();
        }
    }

    private async handleError(item: QueueItem, error: any): Promise<void> {
        const category = categorizeError(error);
        const isRetryable = isRetryableError(category);

        this.lastErrorTime = Date.now();
        this.consecutiveErrors++;

        logger.error(`Processor Error [${category.toUpperCase()}]: ${error.message}`, 'ERROR');

        if (!isRetryable) {
            downloadQueue.fail(item.id, `${error.message} (non-retryable)`);
            notifyDownloadError(item.title || 'Item', error.message);
            return;
        }

        const currentItem = downloadQueue.get(item.id);
        if (currentItem && currentItem.retryCount < currentItem.maxRetries) {
            const delay = calculateRetryDelay(currentItem.retryCount, category);
            const nextTime = Math.round(delay / 1000);

            logger.warn(
                `Retry scheduled in ${nextTime}s (Attempt ${currentItem.retryCount + 1}/${currentItem.maxRetries})`,
                'RETRY'
            );

            downloadQueue.fail(item.id, error.message);

            await sleep(delay);
        } else {
            downloadQueue.fail(item.id, error.message);
            logger.error(`Max retries reached for item: ${item.title}`, 'QUEUE');
            notifyDownloadError(item.title || 'Item', error.message);
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
            },
            onMetadata: (meta) => {
                downloadQueue.updateMetadata(item.id, {
                    title: meta.title,
                    artist: meta.artist,
                    album: meta.album
                });
                logger.info(`Resolved Metadata: ${meta.artist} - ${meta.title}`, 'META');
            },
            onQuality: (quality) => {
                downloadQueue.updateQuality(item.id, quality);
            },
            skipExisting: true
        });

        if (result.success && result.filePath) {
            if (result.quality) {
                downloadQueue.updateQuality(item.id, result.quality);
            }
            downloadQueue.complete(item.id, result.filePath);
            notifyDownloadComplete(item.title || 'Track', result.filePath);
        } else if (result.skipped) {
            downloadQueue.complete(item.id, result.filePath);
            logger.info(`Skipped (File Exists): ${item.title}`, 'SKIP');
        } else {
            throw new Error(result.error || 'Unknown download error');
        }
    }

    private async processBatch(item: QueueItem): Promise<void> {
        const id = item.contentId;
        const type = item.type;

        logger.info(`Starting batch download: ${type} ${id}`, 'BATCH');

        let result;
        const opts = {
            onProgress: () => {},
            skipExisting: true,
            onMetadata: (meta: { title?: string; artist?: string; album?: string }) => {
                downloadQueue.updateMetadata(item.id, {
                    title: meta.title,
                    artist: meta.artist,
                    album: meta.album
                });
                logger.info(`Resolved Batch Metadata: ${meta.title}`, 'META');
            },
            onQuality: (quality: number) => {
                downloadQueue.updateQuality(item.id, quality);
            }
        };

        if (type === 'album') {
            result = await this.downloadService.downloadAlbum(id, item.quality, opts);
        } else if (type === 'playlist') {
            result = await this.downloadService.downloadPlaylist(id, item.quality, opts);
        } else {
            await this.downloadService.downloadArtist(id, item.quality, opts);
            result = { success: true };
        }

        if (result.success) {
            const files: string[] = [];
            if (result.tracks) {
                result.tracks.forEach((t) => {
                    if (t.filePath) files.push(t.filePath);
                });
            }

            downloadQueue.updateMetadata(item.id, {
                ...item.metadata,
                batchFiles: files
            });

            downloadQueue.complete(item.id);
            logger.success(`Batch Download Completed: ${item.title}`, 'BATCH');
            notifyDownloadComplete(item.title || 'Batch', undefined);
        } else {
            throw new Error(result.error || 'Batch download failed');
        }
    }
}

export const queueProcessor = new QueueProcessor();
export const downloadService = queueProcessor['downloadService'];
