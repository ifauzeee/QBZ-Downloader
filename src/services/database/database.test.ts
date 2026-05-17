import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseService } from './index.js';

// Mock logger to avoid console spam
vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('DatabaseService', () => {
    let dbService: DatabaseService;

    beforeEach(() => {
        dbService = new DatabaseService(':memory:');
        dbService.initialize();
    });

    afterEach(() => {
        dbService.close();
    });

    describe('Schema and Initialization', () => {
        it('should initialize and create tables', () => {
            const db = dbService.getDb();
            const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
            const tableNames = tables.map((t: unknown) => (t as { name: string }).name);
            
            expect(tableNames).toContain('tracks');
            expect(tableNames).toContain('albums');
            expect(tableNames).toContain('artists');
            expect(tableNames).toContain('queue_items');
            expect(tableNames).toContain('library_files');
        });

        it('should store and retrieve database version', () => {
            const db = dbService.getDb();
            const version = db.prepare("SELECT value FROM meta WHERE key = 'db_version'").get();
            expect(version.value).toBe('10');
        });
    });

    describe('Track Management', () => {
        const testTrack = {
            id: 'track1',
            title: 'Test Track',
            artist: 'Test Artist',
            album: 'Test Album',
            duration: 180,
            quality: 27,
            file_path: '/path/to/track.flac',
            file_size: 1024
        };

        it('should add and retrieve a track', () => {
            dbService.addTrack(testTrack);
            const retrieved = dbService.getTrack('track1');
            expect(retrieved).toBeDefined();
            expect(retrieved!.title).toBe('Test Track');
            expect(retrieved!.artist).toBe('Test Artist');
        });

        it('should correctly handle track existence check', () => {
            expect(dbService.hasTrack('track1')).toBe(false);
            dbService.addTrack(testTrack);
            expect(dbService.hasTrack('track1')).toBe(true);
        });

        it('should search tracks by title or artist', () => {
            dbService.addTrack(testTrack);
            dbService.addTrack({ ...testTrack, id: 'track2', title: 'Other Song', artist: 'Someone Else' });
            
            const results = dbService.searchTracks('Track');
            expect(results.length).toBe(1);
            expect(results[0].title).toBe('Test Track');
        });

    });

    describe('Statistics', () => {
        it('should update and retrieve daily stats', () => {
            dbService.addTrack({ id: 't1', title: 'T1' });
            const stats = dbService.getDailyStats(1);
            expect(stats.length).toBe(1);
            expect(stats[0].tracks).toBe(1);
        });

        it('should update genre stats', () => {
            dbService.addTrack({ id: 't1', title: 'T1', genre: 'Rock', file_size: 100 });
            const stats = dbService.getGenreStats(1);
            expect(stats.length).toBe(1);
            expect(stats[0].genre).toBe('Rock');
            expect(stats[0].count).toBe(1);
        });
    });

    describe('Library Management', () => {
        it('should add and retrieve library files', () => {
            dbService.addLibraryFile({
                file_path: '/lib/track.flac',
                title: 'Lib Track',
                quality: 27
            });
            const files = dbService.getLibraryFiles();
            expect(files.length).toBe(1);
            expect(files[0].title).toBe('Lib Track');
        });

        it('should calculate library health score', () => {
            dbService.addLibraryFile({ file_path: 'f1', missing_metadata: true });
            dbService.addLibraryFile({ file_path: 'f2', missing_metadata: false });
            
            const health = dbService.getLibraryHealth();
            expect(health.totalTracks).toBe(2);
            expect(health.healthScore).toBeLessThan(100);
        });
    });

    describe('Queue Management', () => {
        const testItem = {
            id: 'q1',
            type: 'track',
            contentId: 'c1',
            quality: 27,
            status: 'pending',
            priority: 'normal',
            progress: 0,
            title: 'Queue Item',
            addedAt: new Date()
        };

        it('should add and retrieve queue items', () => {
            dbService.addQueueItem(testItem);
            const items = dbService.getQueueItems();
            expect(items.length).toBe(1);
            expect(items[0].id).toBe('q1');
            expect(items[0].title).toBe('Queue Item');
        });

        it('should update queue item status', () => {
            dbService.addQueueItem(testItem);
            dbService.updateQueueItemStatus('q1', 'downloading', 50);
            const items = dbService.getQueueItems();
            expect(items[0].status).toBe('downloading');
            expect(items[0].progress).toBe(50);
        });
    });
});
