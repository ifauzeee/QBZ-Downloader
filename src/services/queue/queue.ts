import { EventEmitter } from 'events';
import { QueueItem, QueueItemStatus, QueuePriority, QueueStats, DownloadType } from './types.js';
import { generateQueueId } from './utils.js';
import { logger } from '../../utils/logger.js';

export class DownloadQueue {
    private items: Map<string, QueueItem> = new Map();
    private processing: Set<string> = new Set();
    private maxConcurrent: number;
    private paused: boolean = false;
    private eventEmitter: EventEmitter = new EventEmitter();

    constructor(maxConcurrent: number = 2) {
        this.maxConcurrent = maxConcurrent;
    }

    add(
        type: DownloadType,
        contentId: string | number,
        quality: number,
        options: {
            title?: string;
            priority?: QueuePriority;
            maxRetries?: number;
            metadata?: any;
        } = {}
    ): QueueItem {
        const id = generateQueueId();
        const item: QueueItem = {
            id,
            type,
            contentId,
            quality,
            status: 'pending',
            priority: options.priority || 'normal',
            progress: 0,
            title: options.title,
            addedAt: new Date(),
            retryCount: 0,
            maxRetries: options.maxRetries ?? 3,
            metadata: options.metadata
        };

        this.items.set(id, item);

        this.emit('item:added', item);
        logger.debug(`Queue: Added ${type} ${contentId} (${id})`);

        return item;
    }

    getNext(): QueueItem | null {
        if (this.paused) return null;
        if (this.processing.size >= this.maxConcurrent) return null;

        const pending = Array.from(this.items.values())
            .filter((item) => item.status === 'pending')
            .sort((a, b) => {
                const priorityOrder: Record<QueuePriority, number> = {
                    high: 0,
                    normal: 1,
                    low: 2
                };
                const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
                if (priorityDiff !== 0) return priorityDiff;
                return a.addedAt.getTime() - b.addedAt.getTime();
            });

        return pending[0] || null;
    }

    startItem(id: string): boolean {
        const item = this.items.get(id);
        if (!item || item.status !== 'pending') return false;

        item.status = 'downloading';
        item.startedAt = new Date();
        this.processing.add(id);

        this.emit('item:started', item);
        logger.debug(`Queue: Started ${id}`);

        return true;
    }

    updateProgress(id: string, progress: number, status?: QueueItemStatus): void {
        const item = this.items.get(id);
        if (!item) return;

        item.progress = Math.min(100, Math.max(0, progress));
        if (status) {
            item.status = status;
        }
        this.emit('item:progress', item, progress);
    }

    updateMetadata(id: string, metadata: { title?: string; artist?: any; album?: any }): void {
        const item = this.items.get(id);
        if (!item) return;

        if (metadata.title) item.title = metadata.title;
        if (metadata.artist) item.artist = metadata.artist;
        if (metadata.album) item.album = metadata.album;

        this.emit('item:progress', item, item.progress);
    }

    updateQuality(id: string, quality: number): void {
        const item = this.items.get(id);
        if (!item) return;

        item.quality = quality;
        this.emit('item:progress', item, item.progress);
    }

    complete(id: string, filePath?: string): void {
        const item = this.items.get(id);
        if (!item) return;

        item.status = 'completed';
        item.progress = 100;
        item.completedAt = new Date();
        if (filePath) item.filePath = filePath;
        this.processing.delete(id);

        this.emit('item:completed', item);
        logger.debug(`Queue: Completed ${id}`);

        this.checkQueueEmpty();
    }

    fail(id: string, error: string): void {
        const item = this.items.get(id);
        if (!item) return;

        item.error = error;

        if (item.retryCount < item.maxRetries) {
            item.retryCount++;
            item.status = 'pending';
            item.progress = 0;
            logger.debug(`Queue: Retry ${item.retryCount}/${item.maxRetries} for ${id}`);
        } else {
            item.status = 'failed';
            item.completedAt = new Date();

            this.emit('item:failed', item, error);
            logger.error(`Queue: Failed ${id}: ${error}`);
        }
        this.processing.delete(id);
        this.checkQueueEmpty();
    }

    getPendingItems(): QueueItem[] {
        return Array.from(this.items.values()).filter((item) => item.status === 'pending');
    }

    get(id: string): QueueItem | undefined {
        return this.items.get(id);
    }

    cancel(id: string): boolean {
        const item = this.items.get(id);
        if (!item) return false;

        this.processing.delete(id);

        item.status = 'failed';

        this.emit('item:failed', item, 'Cancelled by user');
        this.items.delete(id);

        return true;
    }

    remove(id: string): boolean {
        const item = this.items.get(id);
        if (!item) return false;

        if (this.processing.has(id)) {
            return false;
        }

        this.items.delete(id);
        return true;
    }

    clearCompleted(): number {
        let count = 0;
        for (const [id, item] of this.items) {
            if (
                item.status === 'completed' ||
                item.status === 'failed' ||
                item.status === 'cancelled'
            ) {
                this.items.delete(id);
                count++;
            }
        }
        return count;
    }

    clearPending(): number {
        let count = 0;
        for (const [id, item] of this.items) {
            if (item.status === 'pending') {
                this.items.delete(id);
                count++;
            }
        }
        return count;
    }

    clear(): number {
        let count = 0;
        for (const [id, item] of this.items) {
            if (
                item.status !== 'downloading' &&
                item.status !== 'processing' &&
                item.status !== 'uploading'
            ) {
                this.items.delete(id);
                count++;
            }
        }
        this.emit('queue:empty');

        return count;
    }

    getAll(): QueueItem[] {
        return Array.from(this.items.values());
    }

    getByStatus(status: QueueItemStatus): QueueItem[] {
        return Array.from(this.items.values()).filter((item) => item.status === status);
    }

    getStats(): QueueStats {
        const items = Array.from(this.items.values());
        return {
            total: items.length,
            pending: items.filter((i) => i.status === 'pending').length,
            downloading: items.filter((i) => i.status === 'downloading').length,
            processing: items.filter((i) => i.status === 'processing' || i.status === 'uploading')
                .length,
            completed: items.filter((i) => i.status === 'completed').length,
            failed: items.filter((i) => i.status === 'failed').length
        };
    }

    getPosition(id: string): number {
        const pending = this.getByStatus('pending').sort(
            (a, b) => a.addedAt.getTime() - b.addedAt.getTime()
        );
        const index = pending.findIndex((item) => item.id === id);
        return index >= 0 ? index + 1 : -1;
    }

    hasPending(): boolean {
        return Array.from(this.items.values()).some((item) => item.status === 'pending');
    }

    isProcessing(): boolean {
        return this.processing.size > 0;
    }

    pause(): void {
        this.paused = true;
        this.emit('queue:paused');
        logger.debug('Queue: Paused');
    }

    resume(): void {
        this.paused = false;
        this.emit('queue:resumed');
        logger.debug('Queue: Resumed');
    }

    isPaused(): boolean {
        return this.paused;
    }

    setMaxConcurrent(max: number): void {
        this.maxConcurrent = Math.max(1, max);
    }

    getMaxConcurrent(): number {
        return this.maxConcurrent;
    }

    hasContent(type: DownloadType, contentId: string | number): boolean {
        return Array.from(this.items.values()).some(
            (item) =>
                item.type === type &&
                item.contentId.toString() === contentId.toString() &&
                (item.status === 'pending' ||
                    item.status === 'downloading' ||
                    item.status === 'processing')
        );
    }

    private checkQueueEmpty(): void {
        if (!this.hasPending() && !this.isProcessing()) {
            this.emit('queue:empty');
        }
    }

    on(event: string, listener: (...args: any[]) => void): this {
        this.eventEmitter.on(event, listener);
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        return this.eventEmitter.emit(event, ...args);
    }

    off(event: string, listener: (...args: any[]) => void): this {
        this.eventEmitter.off(event, listener);
        return this;
    }

    getItems(): QueueItem[] {
        return Array.from(this.items.values());
    }
}

export const downloadQueue = new DownloadQueue(2);
