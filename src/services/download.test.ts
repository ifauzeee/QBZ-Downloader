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
});
