import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryService } from './history.js';
import fs from 'fs';

// Mock fs
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        existsSync: vi.fn(),
        default: {
            ...actual,
            existsSync: vi.fn()
        }
    };
});

import { databaseService } from './database/index.js';

// Mock logger
vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        system: vi.fn()
    }
}));

describe('HistoryService', () => {
    let history: HistoryService;
    const testJsonPath = './data/test-history.json';

    beforeEach(() => {
        vi.clearAllMocks();
        (databaseService as unknown as { dbPath: string }).dbPath = ':memory:';
        (databaseService as unknown as { initialized: boolean }).initialized = false;
        databaseService.initialize();
        history = new HistoryService(testJsonPath);
    });

    it('should add entries and save', () => {
        history.add('track1', {
            filename: 'test.flac',
            quality: 27,
            title: 'Test Song',
            artist: 'Tester'
        });

        expect(history.count()).toBe(1);
        expect(history.has('track1')).toBe(true);
    });

    it('should retrieve entries correctly', () => {
        history.add('t1', { filename: 'f1', quality: 27, title: 'T1' });
        const entry = history.get('t1');
        expect(entry).toBeDefined();
        expect(entry?.title).toBe('T1');
    });

    it('should search entries', () => {
        history.add('t1', { filename: 'f1', quality: 27, title: 'Specific Title', artist: 'Artist A' });
        history.add('t2', { filename: 'f2', quality: 27, title: 'Other', artist: 'Artist B' });
        
        const results = history.search('Specific');
        expect(results.length).toBe(1);
        expect(results[0].title).toBe('Specific Title');
    });

    it('should sort entries by date', async () => {
        history.add('t1', { filename: 'f1', quality: 27, title: 'T1' });
        // Add a small delay to ensure different timestamps
        await new Promise(r => setTimeout(r, 10));
        history.add('t2', { filename: 'f2', quality: 27, title: 'T2' });
        
        const sorted = history.getSorted();
        expect(sorted.length).toBe(2);
        expect(sorted[0].id).toBe('t2'); // t2 is newer
    });

    it('should remove entries', () => {
        history.add('t1', { filename: 'f1', quality: 27, title: 'T1' });
        expect(history.count()).toBe(1);
        history.remove('t1');
        expect(history.count()).toBe(0);
    });

    it('should cleanup missing files', () => {
        history.add('t1', { filename: 'existing.flac', quality: 27, title: 'T1' });
        history.add('t2', { filename: 'missing.flac', quality: 27, title: 'T2' });
        
        vi.mocked(fs.existsSync).mockImplementation((p: fs.PathLike) => p.toString() === 'existing.flac');
        
        const cleaned = history.cleanup();
        expect(cleaned).toBe(1);
        expect(history.count()).toBe(1);
        expect(history.has('t1')).toBe(true);
        expect(history.has('t2')).toBe(false);
    });
});
