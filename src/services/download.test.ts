import { describe, it, expect, vi, beforeEach } from 'vitest';
import DownloadService from './download.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from './metadata.js';

vi.mock('../api/qobuz.js');
vi.mock('../api/lyrics.js');
vi.mock('./metadata.js');
vi.mock('fs');
vi.mock('axios');
vi.mock('./history.js', () => ({
    historyService: {
        has: vi.fn(),
        get: vi.fn(),
        add: vi.fn(),
        getAll: vi.fn(),
        clearAll: vi.fn()
    }
}));
vi.mock('./settings.js', () => ({
    settingsService: {
        get: vi.fn(),
        set: vi.fn(),
        saveSettings: vi.fn(),
        settings: {
            downloads: {
                path: './downloads',
                folderTemplate: '{artist}/{album}',
                fileTemplate: '{track_number}. {title}',
                concurrent: 4,
                retryAttempts: 3,
                retryDelay: 1000
            },
            metadata: {
                embedLyrics: true,
                embedCover: true,
                saveCoverFile: false
            }
        }
    }
}));

describe('DownloadService', () => {
    let downloadService: DownloadService;
    let mockApi: any;
    let mockLyrics: any;
    let mockMetadata: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockApi = {
            getTrack: vi.fn(),
            getFileUrl: vi.fn(),
            getAlbum: vi.fn()
        } as unknown as QobuzAPI;

        mockLyrics = {
            getLyrics: vi.fn()
        } as unknown as LyricsProvider;

        mockMetadata = {
            extractMetadata: vi.fn(),
            buildId3Tags: vi.fn(),
            writeId3Tags: vi.fn(),
            buildFlacTags: vi.fn()
        } as unknown as MetadataService;

        downloadService = new DownloadService(mockApi, mockLyrics, mockMetadata);
    });

    it('should be defined', () => {
        expect(downloadService).toBeDefined();
    });

    describe('sanitizeFilename', () => {
        it('should remove invalid characters', () => {
            expect(downloadService.sanitizeFilename('Test:File?Name')).toBe('TestFileName');
        });

        it('should remove angle brackets', () => {
            expect(downloadService.sanitizeFilename('Test<File>Name')).toBe('TestFileName');
        });

        it('should remove quotes', () => {
            expect(downloadService.sanitizeFilename('Test"File"Name')).toBe('TestFileName');
        });

        it('should remove forward and back slashes', () => {
            expect(downloadService.sanitizeFilename('Test/File\\Name')).toBe('TestFileName');
        });

        it('should remove pipe and asterisk', () => {
            expect(downloadService.sanitizeFilename('Test|File*Name')).toBe('TestFileName');
        });

        it('should collapse multiple spaces', () => {
            expect(downloadService.sanitizeFilename('Test    File   Name')).toBe('Test File Name');
        });

        it('should return Unknown for empty string', () => {
            expect(downloadService.sanitizeFilename('')).toBe('Unknown');
        });

        it('should return Unknown for null/undefined', () => {
            expect(downloadService.sanitizeFilename(null as any)).toBe('Unknown');
            expect(downloadService.sanitizeFilename(undefined as any)).toBe('Unknown');
        });

        it('should truncate long names to 128 chars', () => {
            const longName = 'A'.repeat(250);
            expect(downloadService.sanitizeFilename(longName).length).toBe(128);
        });

        it('should trim leading and trailing spaces', () => {
            expect(downloadService.sanitizeFilename('  Test  ')).toBe('Test');
        });

        it('should handle complex filenames', () => {
            const complex = 'Artist - Track: "Remix" (feat. Other) [Explicit]';
            const result = downloadService.sanitizeFilename(complex);
            expect(result).not.toContain(':');
            expect(result).not.toContain('"');
            expect(result).toContain('Remix');
        });
    });

    describe('buildFilename', () => {
        it('should build filename with track number', () => {
            const metadata = {
                title: 'Test Track',
                artist: 'Test Artist',
                album: 'Test Album',
                trackNumber: 1,
                year: 2024
            };

            const result = downloadService.buildFilename(metadata as any, 'flac');
            expect(result).toContain('01');
            expect(result).toContain('Test Track');
            expect(result).toMatch(/\.flac$/);
        });

        it('should pad track number with zero', () => {
            const metadata = {
                title: 'Track',
                artist: 'Artist',
                album: 'Album',
                trackNumber: 5
            };

            const result = downloadService.buildFilename(metadata as any, 'flac');
            expect(result).toContain('05');
        });

        it('should use 01 as default for missing track number', () => {
            const metadata = {
                title: 'Track',
                artist: 'Artist',
                album: 'Album'
            };

            const result = downloadService.buildFilename(metadata as any, 'flac');
            expect(result).toContain('01');
        });

        it('should always use flac extension regardless of quality parameter', () => {
            const metadata = {
                title: 'Track',
                trackNumber: 1
            };

            const result = downloadService.buildFilename(metadata as any, 5);
            expect(result).toMatch(/\.flac$/);
        });
    });

    describe('buildFolderPath', () => {
        it('should build folder path with artist and album', () => {
            const metadata = {
                artist: 'Test Artist',
                albumArtist: 'Test Album Artist',
                album: 'Test Album',
                year: 2024
            };

            const result = downloadService.buildFolderPath(metadata as any, 27);
            expect(result).toContain('Test Album Artist');
            expect(result).toContain('Test Album');
        });

        it('should use artist if albumArtist is not available', () => {
            const metadata = {
                artist: 'Test Artist',
                album: 'Test Album'
            };

            const result = downloadService.buildFolderPath(metadata as any, 27);
            expect(result).toContain('Test Artist');
        });
    });
});
