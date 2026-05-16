import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueueProcessor } from './queue-processor.js';
import { downloadQueue } from './queue/queue.js';
import DownloadService from './download.js';
import QobuzAPI from '../api/qobuz.js';

vi.mock('./queue/queue.js', () => ({
    downloadQueue: {
        getPendingItems: vi.fn(),
        updateMetadata: vi.fn(),
        on: vi.fn(),
        isPaused: vi.fn().mockReturnValue(false),
        dequeue: vi.fn(),
        fail: vi.fn(),
        complete: vi.fn(),
        get: vi.fn(),
        updateProgress: vi.fn(),
        updateQuality: vi.fn(),
        requeue: vi.fn()
    }
}));

vi.mock('./download.js', () => {
    return {
        default: vi.fn().mockImplementation(function() {
            return {
                downloadTrack: vi.fn()
            };
        })
    };
});

vi.mock('../api/qobuz.js', () => {
    return {
        default: vi.fn().mockImplementation(function() {
            return {
                getTrack: vi.fn(),
                getAlbum: vi.fn(),
                getPlaylist: vi.fn(),
                getArtist: vi.fn()
            };
        })
    };
});

vi.mock('./lyrics.js', () => ({
    default: vi.fn().mockImplementation(function() {
        return {
            parseLrc: vi.fn(),
            toSylt: vi.fn(),
            getLyrics: vi.fn()
        };
    })
}));

vi.mock('./metadata.js', () => ({
    default: vi.fn().mockImplementation(function() {
        return {
            extractMetadata: vi.fn(),
            writeMetadata: vi.fn(),
            getCoverUrlCandidates: vi.fn()
        };
    })
}));


vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

// Mock sleep to be instant
vi.mock('./queue-processor.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./queue-processor.js')>();
    return {
        ...actual,
        // We can't easily mock the private sleep function if it's not exported
        // But it's used inside the class.
    };
});


vi.mock('./notifications.js', () => ({
    notifyDownloadComplete: vi.fn(),
    notifyDownloadError: vi.fn()
}));

vi.mock('../config.js', () => ({
    CONFIG: {
        download: { retryDelay: 100, outputDir: './downloads' },
        quality: { default: 27 }
    }
}));

describe('QueueProcessor', () => {
    let processor: QueueProcessor;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        processor = new QueueProcessor();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('should hydrate metadata for pending items', async () => {
        const mockItem = {
            id: '1',
            type: 'track',
            contentId: 'track1',
            title: 'track: track1'
        };

        vi.mocked(downloadQueue.getPendingItems).mockReturnValue([mockItem as any]);
        const mockApi = (processor as any).api;
        mockApi.getTrack.mockResolvedValue({
            success: true,
            data: { title: 'Real Title', performer: { name: 'Real Artist' }, album: { title: 'Real Album' } }
        });

        // Start hydration in background
        (processor as any).startMetadataHydration();
        
        // Wait for one loop
        await vi.advanceTimersByTimeAsync(500);

        expect(downloadQueue.updateMetadata).toHaveBeenCalledWith('1', {
            title: 'Real Title',
            artist: 'Real Artist',
            album: 'Real Album'
        });

        // Stop hydration for cleanup
        (processor as any).isHydrationRunning = false;
    });

    it('should activate circuit breaker after consecutive errors', async () => {
        const mockItem = { id: '1', type: 'track', contentId: 't1', title: 'T1' };
        vi.mocked(downloadQueue.dequeue).mockReturnValue(mockItem as any).mockReturnValueOnce(mockItem as any).mockReturnValue(null);
        vi.mocked(downloadQueue.get).mockReturnValue(mockItem as any);

        const mockDownloadService = (processor as any).downloadService;
        mockDownloadService.downloadTrack.mockRejectedValue(new Error('Network Error'));

        // Manually set consecutive errors to trigger circuit breaker
        (processor as any).consecutiveErrors = 5;
        (processor as any).lastErrorTime = Date.now();

        const processPromise = (processor as any).processNext();
        
        // Should trigger sleep
        await vi.advanceTimersByTimeAsync(30000);
        await processPromise;

        expect((processor as any).consecutiveErrors).toBeLessThan(5);
    });

    it('should retry item on retryable error', async () => {
        const mockItem = { id: '1', type: 'track', contentId: 't1', title: 'T1', retryCount: 1, maxRetries: 3 };
        vi.mocked(downloadQueue.get).mockReturnValue(mockItem as any);
        
        const error = new Error('Network timeout');
        (error as any).statusCode = 503;

        const handlePromise = (processor as any).handleError(mockItem, error);
        
        // Advance timers to trigger the setTimeout inside handleError
        await vi.advanceTimersByTimeAsync(5000);
        await handlePromise;

        expect(downloadQueue.fail).toHaveBeenCalledWith('1', 'Network timeout');
        expect(downloadQueue.requeue).toHaveBeenCalledWith('1');
    });


    it('should fail item immediately on non-retryable error', async () => {
        const mockItem = { id: '1', type: 'track', contentId: 't1', title: 'T1', retryCount: 0, maxRetries: 3 };
        
        const error = new Error('Not found');
        (error as any).statusCode = 404;

        await (processor as any).handleError(mockItem, error);

        expect(downloadQueue.fail).toHaveBeenCalledWith('1', 'Not found');
    });
});
