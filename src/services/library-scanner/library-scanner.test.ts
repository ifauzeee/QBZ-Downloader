import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryScannerService } from './index.js';
import { databaseService } from '../database/index.js';
import { EventEmitter } from 'events';

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

vi.mock('../../utils/network.js', () => ({
    downloadFile: vi.fn().mockImplementation(() => {
        const stream = new EventEmitter();
        (stream as unknown as { destroy: () => void; destroyed: boolean }).destroy = vi.fn(
            () => {
                (stream as unknown as { destroyed: boolean }).destroyed = true;
            }
        );
        (stream as unknown as { destroyed: boolean }).destroyed = false;
        setTimeout(() => stream.emit('data', Buffer.alloc(2048)), 0);
        return Promise.resolve({ data: stream });
    })
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
        vi.clearAllMocks();
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

        it('should not flag remix releases as duplicates based on title only', async () => {
            vi.mocked(databaseService.getLibraryFiles).mockReturnValue([
                {
                    file_path: 'Music/The Weeknd/After Hours (Explicit)/11. Save Your Tears.flac',
                    audio_fingerprint: null,
                    title: 'Save Your Tears',
                    artist: 'The Weeknd',
                    album: 'After Hours (Explicit)'
                },
                {
                    file_path: 'Music/The Weeknd/Save Your Tears (Remix with Ariana Grande)/01. Save Your Tears.flac',
                    audio_fingerprint: null,
                    title: 'Save Your Tears',
                    artist: 'The Weeknd',
                    album: 'Save Your Tears (Remix with Ariana Grande)'
                }
            ]);

            const count = await scanner.detectDuplicates();

            expect(count).toBe(0);
            expect(databaseService.addDuplicate).not.toHaveBeenCalled();
        });
    });

    describe('Upgrade Detection Logic', () => {
        it('should detect a Hi-Res upgrade from a different release with the same title and artist', async () => {
            const run = vi.fn();
            vi.mocked(databaseService.getDb).mockReturnValue({
                prepare: vi.fn().mockReturnValue({ run })
            } as any);
            vi.mocked(databaseService.getLibraryFiles).mockReturnValue([
                {
                    file_path: 'Music/Artist/CD Release/01. Same Song.flac',
                    track_id: null,
                    available_quality: null,
                    quality: 6,
                    title: 'Same Song',
                    artist: 'Artist',
                    album: 'CD Release'
                }
            ]);

            (scanner as any).api = {
                search: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        tracks: {
                            items: [
                                {
                                    id: 123,
                                    title: 'Same Song',
                                    performer: { name: 'Artist' },
                                    album: { title: 'Hi-Res Edition', artist: { name: 'Artist' } }
                                },
                                {
                                    id: 456,
                                    title: 'Same Song Remix',
                                    performer: { name: 'Artist' },
                                    album: { title: 'Remix Single', artist: { name: 'Artist' } }
                                }
                            ]
                        }
                    }
                }),
                getFileUrl: vi.fn().mockResolvedValue({
                    success: true,
                    data: { url: 'https://stream.example/track.flac', format_id: 27, quality_verified: true }
                })
            };

            const count = await (scanner as any).checkQobuzUpgrades();

            expect(count).toBe(1);
            expect(run).toHaveBeenCalledWith(
                '123',
                27,
                expect.stringContaining('"trackId":"123"'),
                'Music/Artist/CD Release/01. Same Song.flac'
            );
            expect(run.mock.calls[0][2]).toContain('"trackId":"456"');
            expect(run.mock.calls[0][2]).toContain('"variantWarning":true');
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
