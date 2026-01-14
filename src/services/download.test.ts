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

        it('should truncate long names to 200 chars', () => {
            const longName = 'A'.repeat(250);
            expect(downloadService.sanitizeFilename(longName).length).toBe(200);
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

        it('should use 00 for missing track number', () => {
            const metadata = {
                title: 'Track',
                artist: 'Artist',
                album: 'Album'
            };

            const result = downloadService.buildFilename(metadata as any, 'flac');
            expect(result).toContain('00');
        });

        it('should support mp3 extension', () => {
            const metadata = {
                title: 'Track',
                trackNumber: 1
            };

            const result = downloadService.buildFilename(metadata as any, 'mp3');
            expect(result).toMatch(/\.mp3$/);
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
