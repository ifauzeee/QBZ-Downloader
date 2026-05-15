import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueProcessor } from './queue-processor.js';
import { downloadQueue } from './queue/queue.js';
import QobuzAPI from '../api/qobuz.js';
import { databaseService } from './database/index.js';
import { historyService } from './history.js';
import fs from 'fs';

// This is a high-level integration test
vi.mock('../api/qobuz.js', () => ({
    default: vi.fn().mockImplementation(function() {
        return {
            getTrack: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    id: 'track1',
                    title: 'Integrasi Test',
                    performer: { name: 'Antigravity' },
                    album: { id: 'album1', title: 'Deepmind Album' }
                }
            }),
            getAlbum: vi.fn().mockResolvedValue({
                success: true,
                data: { id: 'album1', title: 'Deepmind Album' }
            }),
            getFileUrl: vi.fn().mockResolvedValue({
                success: true,
                data: { url: 'http://mock/stream', format_id: 27 }
            })
        };
    })
}));

vi.mock('../utils/network.js', () => ({
    createAxiosInstance: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: Buffer.alloc(10), headers: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
    }),
    downloadFile: vi.fn().mockImplementation((url, opts) => {
        return Promise.resolve({
            status: 200,
            data: {
                pipe: vi.fn().mockImplementation((writer) => {
                    setTimeout(() => writer.end(), 10);
                    return writer;
                }),
                on: vi.fn(),
                destroy: vi.fn()
            }
        });
    })
}));



vi.mock('axios', () => ({
    default: {
        get: vi.fn().mockResolvedValue({
            status: 200,
            data: Buffer.alloc(100),
            headers: { 'content-length': '100' }
        })
    }
}));

vi.mock('./metadata.js', () => ({
    default: vi.fn().mockImplementation(function() {
        return {
            extractMetadata: vi.fn().mockResolvedValue({
                title: 'Integrasi Test',
                artist: 'Antigravity',
                album: 'Deepmind Album',
                duration: 180,
                coverUrl: 'url'
            }),
            writeMetadata: vi.fn().mockResolvedValue(true),
            getCoverUrlCandidates: vi.fn().mockReturnValue(['url'])
        };
    })
}));

const { mockDatabaseService } = vi.hoisted(() => ({

    mockDatabaseService: {
        addQueueItem: vi.fn(),
        updateQueueItemStatus: vi.fn(),
        addTrack: vi.fn(() => console.log('DEBUG: addTrack called!')),
        getQueueItems: vi.fn().mockReturnValue([]),
        deleteTrackByPath: vi.fn()
    }
}));


vi.mock('./database/index.js', () => ({
    databaseService: mockDatabaseService
}));



vi.mock('./history.js', () => ({
    historyService: {
        add: vi.fn(),
        has: vi.fn().mockReturnValue(false)
    }
}));

vi.mock('./notifications.js', () => ({
    notifyDownloadComplete: vi.fn(),
    notifyDownloadError: vi.fn(),
    notificationService: { info: vi.fn(), error: vi.fn(), success: vi.fn() }
}));

vi.mock('./AIMetadataService.js', () => ({
    aiMetadataService: { repairMetadata: vi.fn().mockResolvedValue(null) }
}));

vi.mock('./QualityScannerService.js', () => ({
    qualityScannerService: { scanFile: vi.fn().mockResolvedValue({ isTrueLossless: true, details: 'OK' }) }
}));

vi.mock('./MediaServerService.js', () => ({
    mediaServerService: { notifyNewContent: vi.fn() }
}));

vi.mock('./FormatConverterService.js', () => ({
    formatConverterService: { convert: vi.fn().mockResolvedValue(null) }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn(),
        debug: vi.fn(),
        system: vi.fn()
    }
}));

vi.mock('../config.js', () => ({
    CONFIG: {
        ai: { enabled: false },
        download: { outputDir: './downloads', folderStructure: '{artist}/{album}', fileNaming: '{track_number}. {title}', retryDelay: 100 },
        quality: { 
            default: 27,
            formats: {
                27: { name: 'FLAC', extension: 'flac' },
                5: { name: 'MP3', extension: 'mp3' }
            }
        },
        metadata: { downloadLyrics: false, embedCover: false, saveCoverFile: false, embedLyrics: false }
    },
    normalizeDownloadQuality: vi.fn((q) => q)
}));

// Partially mock fs
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        default: {
            ...actual,
            existsSync: vi.fn().mockReturnValue(false),
            mkdirSync: vi.fn(),
            writeFileSync: vi.fn(),
            createWriteStream: vi.fn().mockReturnValue({
                on: vi.fn().mockImplementation(function(this: unknown, event, cb) {
                    if (event === 'finish') setTimeout(cb, 10);
                    return this as unknown as Record<string, unknown>;
                }),
                once: vi.fn(),
                emit: vi.fn(),
                write: vi.fn().mockReturnValue(true),
                end: vi.fn().mockImplementation(function(this: unknown) {
                    (this as Record<string, unknown>).emit('finish');
                    return this as unknown as Record<string, unknown>;
                }),
                destroy: vi.fn(),
                closed: false
            })
        }
    };
});


describe('Download Integration Flow', () => {
    let processor: QueueProcessor;

    beforeEach(() => {
        vi.clearAllMocks();
        processor = new QueueProcessor();
    });

    it('should process a track from addition to completion', async () => {
        // 1. Start processor first so it listens to events
        processor.start();

        // 2. Add track to queue
        const item = downloadQueue.add('track', 'track1', 27, { title: 'Initial' });

        // 3. Wait for processing
        await new Promise(resolve => setTimeout(resolve, 500));

        // 4. Verify results
        const updatedItem = downloadQueue.get(item.id);
        console.log('ITEM STATUS:', updatedItem?.status, 'ERROR:', updatedItem?.error);
        
        // The most important thing is that it finished successfully
        expect(updatedItem?.status).toBe('completed');
        expect(updatedItem?.progress).toBe(100);
        expect(updatedItem?.error).toBeUndefined();
    });




});
