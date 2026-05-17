import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryScannerService } from './index.js';
import { databaseService } from '../database/index.js';

// Mock dependencies
vi.mock('../database/index.js', () => ({
    databaseService: {
        clearLibraryScan: vi.fn(),
        getLibraryFiles: vi.fn().mockReturnValue([]),
        addLibraryFile: vi.fn(),
        addDuplicate: vi.fn(),
        getUpgradeableFiles: vi.fn().mockReturnValue([]),
        getDuplicates: vi.fn().mockReturnValue([]),
        getMissingMetadataFiles: vi.fn().mockReturnValue([]),
        getDb: vi.fn().mockReturnValue({
            prepare: vi.fn().mockReturnValue({
                get: vi.fn().mockReturnValue({ count: 0, size: 0 }),
                all: vi.fn().mockReturnValue([]),
                run: vi.fn()
            })
        })
    }
}));

vi.mock('../../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

vi.mock('../../api/qobuz.js', () => {
    const mock = vi.fn().mockImplementation(() => {
        return {
            search: vi.fn().mockResolvedValue({ success: true, data: { tracks: { items: [] } } }),
            getFileUrl: vi.fn().mockResolvedValue({ success: true, data: { format_id: 6 } })
        };
    });
    return {
        default: mock,
        QobuzAPI: mock
    };
});



describe('LibraryScannerService', () => {
    let scanner: LibraryScannerService;

    beforeEach(() => {
        scanner = new LibraryScannerService();
    });

    describe('String Utilities', () => {
        it('should normalize strings correctly', () => {
            const input = '  Testing...  123!!!  ';
            const expected = 'testing 123';
            expect(scanner.normalizeString(input)).toBe(expected);
        });

        it('should calculate similarity correctly', () => {
            expect(scanner.similarity('hello', 'hello')).toBe(1);
            expect(scanner.similarity('hello', 'hallo')).toBeGreaterThan(0.7);
            expect(scanner.similarity('hello', 'world')).toBeLessThan(0.3);
        });

        it('should identify substrings as highly similar', () => {
            expect(scanner.similarity('stereo love', 'stereo love (original mix)')).toBe(0.9);
        });
    });

    describe('Duplicate Detection Logic', () => {
        it('should detect duplicates based on fingerprints', async () => {
            vi.mocked(databaseService.getLibraryFiles).mockReturnValue([
                { file_path: 'path1', audio_fingerprint: 'fp1', title: 'Song 1' },
                { file_path: 'path2', audio_fingerprint: 'fp1', title: 'Song 1 (Alt)' }
            ]);

            const count = await scanner.detectDuplicates();
            expect(count).toBe(1);
            expect(databaseService.addDuplicate).toHaveBeenCalledWith('path1', 'path2', 'exact', 1.0);
        });

        it('should detect duplicates based on metadata similarity', async () => {
            vi.mocked(databaseService.getLibraryFiles).mockReturnValue([
                { file_path: 'path1', audio_fingerprint: null, title: 'Stereo Love', artist: 'Edward Maya' },
                { file_path: 'path2', audio_fingerprint: null, title: 'stereo love', artist: 'Edward Maya & Vika Jigulina' }
            ]);

            const count = await scanner.detectDuplicates();
            expect(count).toBe(1);
            expect(databaseService.addDuplicate).toHaveBeenCalledWith(
                expect.any(String), 
                expect.any(String), 
                'similar', 
                expect.any(Number)
            );
        });
    });

    describe('Quality Labels', () => {
        it('should return correct labels for qualities', () => {
            expect(scanner.getQualityLabel(5)).toBe('MP3 320');
            expect(scanner.getQualityLabel(6)).toBe('FLAC 16/44');
            expect(scanner.getQualityLabel(27)).toBe('FLAC 24/192');
            expect(scanner.getQualityLabel(123)).toBe('Q123');
        });
    });

    describe('Scanning State', () => {
        it('should report scanning status correctly', () => {
            expect(scanner.isScanInProgress()).toBe(false);
        });
    });
});
