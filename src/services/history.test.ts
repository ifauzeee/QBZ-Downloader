import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import { HistoryService } from './history.js';
import { db } from './database.js';

vi.mock('./database.js', () => ({
    db: {
        getHistory: vi.fn(),
        addToHistory: vi.fn(),
        getAllHistory: vi.fn().mockReturnValue([])
    }
}));

vi.mock('fs', async () => {
    return {
        default: {
            existsSync: vi.fn(),
            readFileSync: vi.fn(),
            renameSync: vi.fn(),
            writeFileSync: vi.fn()
        },
        existsSync: vi.fn(),
        readFileSync: vi.fn(),
        renameSync: vi.fn(),
        writeFileSync: vi.fn()
    };
});

describe('HistoryService', () => {
    const testFile = 'test-history.json';
    let service: HistoryService;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor & migration', () => {
        it('should migrate existing json if db is empty', () => {
            (db.getAllHistory as any).mockReturnValue([]);

            (fs.existsSync as any).mockReturnValue(true);
            (fs.readFileSync as any).mockReturnValue(
                JSON.stringify({
                    tracks: {
                        '123': {
                            title: 'Test',
                            quality: 27,
                            filename: 'path/to/file',
                            downloadedAt: 'date'
                        }
                    }
                })
            );

            service = new HistoryService(testFile);

            expect(db.addToHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '123',
                    title: 'Test'
                })
            );

            expect(fs.renameSync).toHaveBeenCalled();
        });

        it('should NOT migrate if db has data', () => {
            (db.getAllHistory as any).mockReturnValue([{ id: 'existing' }]);

            (fs.existsSync as any).mockReturnValue(true);

            service = new HistoryService(testFile);

            expect(db.addToHistory).not.toHaveBeenCalled();
            expect(fs.renameSync).not.toHaveBeenCalled();
        });
    });

    describe('has', () => {
        it('should return true if db returns result', () => {
            (db.getHistory as any).mockReturnValue({ id: '123' });
            service = new HistoryService();
            expect(service.has('123')).toBe(true);
        });

        it('should return false if db returns null', () => {
            (db.getHistory as any).mockReturnValue(undefined);
            service = new HistoryService();
            expect(service.has('999')).toBe(false);
        });
    });

    describe('get', () => {
        it('should return formatted entry from db', () => {
            (db.getHistory as any).mockReturnValue({
                id: '123',
                title: 'Title',
                quality: 27,
                filepath: 'path',
                downloaded_at: '2023-01-01'
            });
            service = new HistoryService();

            const result = service.get('123');
            expect(result).toBeDefined();
            expect(result?.title).toBe('Title');
            expect(result?.filename).toBe('path');
        });
    });

    describe('add', () => {
        it('should call db.addToHistory', () => {
            service = new HistoryService();
            service.add('123', {
                title: 'New Track',
                quality: 27,
                filename: 'new/path'
            });

            expect(db.addToHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '123',
                    title: 'New Track',
                    filepath: 'new/path'
                })
            );
        });
    });
});
