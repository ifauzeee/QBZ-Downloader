import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import { HistoryService } from './history.js';

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        default: {
            ...actual,
            existsSync: vi.fn(),
            readFileSync: vi.fn(),
            writeFileSync: vi.fn(),
            mkdirSync: vi.fn()
        },
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn()
    };
});

vi.mock('../utils/logger.js', () => ({
    logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

describe('HistoryService', () => {
    let service: HistoryService;
    const testPath = './test-data/history.json';

    beforeEach(() => {
        vi.clearAllMocks();
        (fs.existsSync as any).mockReturnValue(false);
        service = new HistoryService(testPath);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should create empty history when file does not exist', () => {
            (fs.existsSync as any).mockReturnValue(false);
            const svc = new HistoryService(testPath);
            expect(svc.count()).toBe(0);
        });

        it('should load existing history from file', () => {
            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(
                JSON.stringify({
                    version: 1,
                    entries: {
                        '123': {
                            title: 'Test Track',
                            quality: 27,
                            filename: '/path/to/file.flac',
                            downloadedAt: '2024-01-01T00:00:00Z'
                        }
                    }
                })
            );

            const svc = new HistoryService(testPath);
            expect(svc.count()).toBe(1);
            expect(svc.has('123')).toBe(true);
        });
    });

    describe('has', () => {
        it('should return false for non-existent track', () => {
            expect(service.has('123')).toBe(false);
        });

        it('should return true after adding a track', () => {
            service.add('123', {
                title: 'Test Track',
                quality: 27,
                filename: 'path/to/file.flac'
            });
            expect(service.has('123')).toBe(true);
        });

        it('should work with numeric track IDs', () => {
            service.add(456, {
                title: 'Test Track',
                quality: 27,
                filename: 'path/to/file.flac'
            });
            expect(service.has(456)).toBe(true);
            expect(service.has('456')).toBe(true);
        });
    });

    describe('get', () => {
        it('should return undefined for non-existent track', () => {
            expect(service.get('999')).toBeUndefined();
        });

        it('should return entry with downloadedAt timestamp', () => {
            service.add('123', {
                title: 'Test Track',
                quality: 27,
                filename: 'path/to/file.flac'
            });

            const result = service.get('123');
            expect(result).toBeDefined();
            expect(result?.title).toBe('Test Track');
            expect(result?.quality).toBe(27);
            expect(result?.filename).toBe('path/to/file.flac');
            expect(result?.downloadedAt).toBeDefined();
        });
    });

    describe('getAll', () => {
        it('should return empty object when no entries', () => {
            expect(service.getAll()).toEqual({});
        });

        it('should return all entries as object', () => {
            service.add('123', {
                title: 'Track 1',
                quality: 27,
                filename: 'path1.flac'
            });
            service.add('456', {
                title: 'Track 2',
                quality: 6,
                filename: 'path2.flac'
            });

            const all = service.getAll();
            expect(Object.keys(all)).toHaveLength(2);
            expect(all['123'].title).toBe('Track 1');
            expect(all['456'].title).toBe('Track 2');
        });
    });

    describe('getSorted', () => {
        it('should return entries sorted by date (newest first)', () => {
            service.add('123', { title: 'Track 1', quality: 27, filename: 'p1.flac' });

            const _later = new Date(Date.now() + 1000).toISOString();
            const entry = service.get('123');
            if (entry) entry.downloadedAt = '2024-01-01T00:00:00Z';

            service.add('456', { title: 'Track 2', quality: 6, filename: 'p2.flac' });

            const sorted = service.getSorted();
            expect(sorted.length).toBe(2);
            expect(sorted[0].id).toBe('456');
        });

        it('should respect limit parameter', () => {
            service.add('1', { title: 'T1', quality: 27, filename: 'p1.flac' });
            service.add('2', { title: 'T2', quality: 27, filename: 'p2.flac' });
            service.add('3', { title: 'T3', quality: 27, filename: 'p3.flac' });

            const limited = service.getSorted(2);
            expect(limited.length).toBe(2);
        });
    });

    describe('add', () => {
        it('should add entry with auto-generated downloadedAt', () => {
            const _beforeAdd = new Date().toISOString();

            service.add('123', {
                title: 'New Track',
                quality: 27,
                filename: 'new/path.flac'
            });

            const entry = service.get('123');
            expect(entry).toBeDefined();
            expect(entry?.downloadedAt).toBeDefined();
        });

        it('should overwrite existing entry', () => {
            service.add('123', {
                title: 'Original Title',
                quality: 6,
                filename: 'original.flac'
            });

            service.add('123', {
                title: 'Updated Title',
                quality: 27,
                filename: 'updated.flac'
            });

            const entry = service.get('123');
            expect(entry?.title).toBe('Updated Title');
            expect(entry?.quality).toBe(27);
        });
    });

    describe('remove', () => {
        it('should remove entry and return true', () => {
            service.add('123', { title: 'Track', quality: 27, filename: 'p.flac' });

            const result = service.remove('123');
            expect(result).toBe(true);
            expect(service.has('123')).toBe(false);
        });

        it('should return false for non-existent entry', () => {
            expect(service.remove('999')).toBe(false);
        });
    });

    describe('clearAll', () => {
        it('should remove all entries', () => {
            service.add('123', { title: 'Track 1', quality: 27, filename: 'p1.flac' });
            service.add('456', { title: 'Track 2', quality: 6, filename: 'p2.flac' });

            expect(service.count()).toBe(2);

            service.clearAll();

            expect(service.count()).toBe(0);
            expect(service.has('123')).toBe(false);
        });
    });

    describe('search', () => {
        it('should find entries by title', () => {
            service.add('1', { title: 'Hello World', quality: 27, filename: 'p.flac' });
            service.add('2', { title: 'Goodbye', quality: 27, filename: 'p.flac' });

            const results = service.search('hello');
            expect(results.length).toBe(1);
            expect(results[0].title).toBe('Hello World');
        });

        it('should find entries by artist', () => {
            service.add('1', {
                title: 'Track',
                quality: 27,
                filename: 'p.flac',
                artist: 'The Beatles'
            });
            service.add('2', {
                title: 'Track 2',
                quality: 27,
                filename: 'p.flac',
                artist: 'Pink Floyd'
            });

            const results = service.search('beatles');
            expect(results.length).toBe(1);
        });
    });

    describe('count', () => {
        it('should return correct count', () => {
            expect(service.count()).toBe(0);

            service.add('1', { title: 'T1', quality: 27, filename: 'p.flac' });
            expect(service.count()).toBe(1);

            service.add('2', { title: 'T2', quality: 27, filename: 'p.flac' });
            expect(service.count()).toBe(2);
        });
    });
});
