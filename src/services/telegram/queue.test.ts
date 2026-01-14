import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadQueue } from '../telegram/queue.js';
import { db } from '../database.js';

vi.mock('../database.js', () => ({
    db: {
        getPendingQueue: vi.fn().mockReturnValue([]),
        saveQueueItem: vi.fn(),
        updateQueueStatus: vi.fn(),
        removeQueueItem: vi.fn(),
        clearQueue: vi.fn()
    }
}));

describe('DownloadQueue', () => {
    let queue: DownloadQueue;

    beforeEach(() => {
        vi.clearAllMocks();
        queue = new DownloadQueue(2);
    });

    describe('add', () => {
        it('should add item to queue and save to db', () => {
            const item = queue.add('track', '123', 27, { title: 'Test Track' });

            expect(item).toBeDefined();
            expect(item.type).toBe('track');
            expect(item.contentId).toBe('123');

            expect(db.saveQueueItem).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: item.id,
                    contentId: '123'
                })
            );
        });
    });

    describe('getNext', () => {
        it('should return pending item', () => {
            queue.add('track', '123', 27);
            const next = queue.getNext();
            expect(next).toBeDefined();
            expect(next?.contentId).toBe('123');
        });
    });

    describe('startItem', () => {
        it('should mark item as downloading and update db', () => {
            const item = queue.add('track', '123', 27);
            queue.startItem(item.id);

            const updated = queue.get(item.id);
            expect(updated?.status).toBe('downloading');

            expect(db.updateQueueStatus).toHaveBeenCalledWith(item.id, 'downloading');
        });
    });

    describe('complete', () => {
        it('should mark item as completed and remove from db', () => {
            const item = queue.add('track', '123', 27);
            queue.startItem(item.id);
            queue.complete(item.id, '/path/to/file.flac');

            const updated = queue.get(item.id);
            expect(updated?.status).toBe('completed');

            expect(db.removeQueueItem).toHaveBeenCalledWith(item.id);
        });
    });

    describe('fail', () => {
        it('should mark as failed and update db when max retries reached', () => {
            const item = queue.add('track', '123', 27, { maxRetries: 1 });
            queue.startItem(item.id);
            queue.fail(item.id, 'Error 1');
            queue.startItem(item.id);
            queue.fail(item.id, 'Error 2');

            const updated = queue.get(item.id);
            expect(updated?.status).toBe('failed');

            expect(db.updateQueueStatus).toHaveBeenCalledWith(item.id, 'failed');
        });
    });

    describe('cancel', () => {
        it('should remove item from queue and db', () => {
            const item = queue.add('track', '123', 27);

            expect(queue.cancel(item.id)).toBe(true);
            expect(queue.get(item.id)).toBeUndefined();

            expect(db.removeQueueItem).toHaveBeenCalledWith(item.id);
        });
    });

    describe('clear', () => {
        it('should clear inactive items from queue and db', () => {
            queue.add('track', '1', 27);
            queue.add('track', '2', 27);
            const active = queue.add('track', '3', 27);
            queue.startItem(active.id);

            const cleared = queue.clear();

            expect(cleared).toBe(2);
            expect(queue.getItems().length).toBe(1);
            expect(db.clearQueue).toHaveBeenCalled();
        });
    });

    describe('restoreQueue', () => {
        it('should load pending items from db on init', () => {
            const pendingItems = [
                {
                    id: 'q_1',
                    type: 'track',
                    contentId: '100',
                    quality: 27,
                    priority: 'normal',
                    title: 'Restored'
                }
            ];
            (db.getPendingQueue as any).mockReturnValue(pendingItems);

            const newQueue = new DownloadQueue(2);

            expect(newQueue.getItems().length).toBe(1);
            expect(newQueue.get('q_1')?.title).toBe('Restored');
        });
    });
});
