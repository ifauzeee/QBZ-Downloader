import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueProcessor } from './queue-processor.js';
import { downloadQueue } from './queue/queue.js';

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
            }),
            search: vi.fn().mockResolvedValue({
                success: true,
                data: {
                    tracks: {
                        items: [
                            { id: 'track1', title: 'Integrasi Test', artist: { name: 'Antigravity' } }
                        ]
                    }
                }
            })
        };
    })
}));

vi.mock('../utils/network.js', () => ({
    createAxiosInstance: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ data: Buffer.alloc(10), headers: {} }),
        interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } }
    }),
    downloadFile: vi.fn().mockImplementation((_url, _opts) => {
        return Promise.resolve({
            status: 200,
            data: {
                pipe: vi.fn().mockImplementation((writer) => {
                    setTimeout(() => writer.end(), 10);
                    return writer;
                }),
                on: vi.fn(),
                destroy: vi.fn(),
                destroyed: false
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

vi.mock('../config.js', () => {
    const configMock = {
        ai: { enabled: false, provider: 'none', apiKey: '', model: '' },
        download: { 
            outputDir: './downloads', 
            folderStructure: '{artist}/{album}', 
            fileNaming: '{track_number}. {title}', 
            retryDelay: 100,
            bandwidthLimit: 0,
            retryAttempts: 3,
            concurrent: 2
        },
        quality: { 
            default: 27,
            formats: {
                27: { name: 'FLAC', extension: 'flac' },
                5: { name: 'MP3', extension: 'mp3' }
            }
        },
        metadata: { 
            downloadLyrics: false, 
            embedCover: false, 
            saveCoverFile: false, 
            embedLyrics: false,
            tags: { basic: [], extended: [], credits: [] }
        },
        credentials: { appId: '', appSecret: '', token: '', userId: '' },
        api: { baseUrl: '', endpoints: {} },
        export: { enabled: false },
        dashboard: { port: 3000 },
        mediaServer: { enabled: false }
    };
    return {
        CONFIG: configMock,
        default: configMock,
        normalizeDownloadQuality: vi.fn((q) => q)
    };
});

// Partially mock fs
vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    
    const mockExistsSync = vi.fn().mockReturnValue(false);
    const mockMkdirSync = vi.fn();
    const mockWriteFileSync = vi.fn();
    const mockCreateWriteStream = vi.fn().mockReturnValue({
        on: vi.fn().mockImplementation(function(this: { emit: (event: string) => void }, event, cb) {
            if (event === 'finish') setTimeout(cb, 10);
            return this;
        }),
        once: vi.fn(),
        emit: vi.fn(),
        write: vi.fn().mockReturnValue(true),
        end: vi.fn().mockImplementation(function(this: { emit: (event: string) => void }) {
            this.emit('finish');
            return this;
        }),
        destroy: vi.fn(),
        closed: false
    });

    return {
        ...actual,
        existsSync: mockExistsSync,
        mkdirSync: mockMkdirSync,
        writeFileSync: mockWriteFileSync,
        createWriteStream: mockCreateWriteStream,
        default: {
            ...actual,
            existsSync: mockExistsSync,
            mkdirSync: mockMkdirSync,
            writeFileSync: mockWriteFileSync,
            createWriteStream: mockCreateWriteStream
        }
    };
});


describe('Download Integration Flow', () => {
    let processor: QueueProcessor;

    beforeEach(() => {
        vi.clearAllMocks();
        processor = new QueueProcessor();
    });

    it('should execute full E2E flow: search -> queue -> download -> metadata -> library scan', async () => {
        // 1. Search (Mock API)
        const qobuzApiModule = await import('../api/qobuz.js');
        const QobuzAPI = qobuzApiModule.default;
        const qobuzApi = new QobuzAPI();
        const searchResult = await qobuzApi.search('Integrasi Test');
        
        expect(searchResult.success).toBe(true);
        const trackToDownload = searchResult.data?.tracks?.items[0];
        expect(trackToDownload).toBeDefined();

        // 2. Add to Queue
        processor.start();
        const item = downloadQueue.add('track', trackToDownload!.id, 27, { title: trackToDownload!.title } as any);

        // 3. Wait for Queue and Download to process
        await new Promise(resolve => setTimeout(resolve, 600));

        // Verify queue status
        const updatedItem = downloadQueue.get(item.id);
        expect(updatedItem?.status).toBe('completed');
        expect(updatedItem?.progress).toBe(100);
        expect(updatedItem?.error).toBeUndefined();

        // 4. Verify Database & Library Scan triggers (with polling for async operation)
        for (let i = 0; i < 10; i++) {
            if (mockDatabaseService.addTrack.mock.calls.length > 0) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        expect(mockDatabaseService.addTrack).toHaveBeenCalled();
        
        const mediaServerModule = await import('./MediaServerService.js');
        expect(mediaServerModule.mediaServerService.notifyNewContent).toHaveBeenCalled();
    });
});
