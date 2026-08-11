import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DownloadEngine } from './DownloadEngine.js';
import * as network from '../utils/network.js';
import { resumeService } from './batch.js';
import { Metadata } from './metadata.js';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { AxiosResponse } from 'axios';

vi.mock('../utils/network.js', () => ({
    downloadFile: vi.fn()
}));

vi.mock('./batch.js', () => ({
    resumeService: {
        getPartial: vi.fn().mockReturnValue(undefined),
        canResume: vi.fn().mockReturnValue(false),
        getResumePosition: vi.fn().mockReturnValue(0),
        startDownload: vi.fn(),
        updateProgress: vi.fn()
    }
}));

vi.mock('fs', async () => {
    const { EventEmitter } = await import('events');
    return {
        createWriteStream: vi.fn().mockImplementation(() => {
            const writer = new EventEmitter();
            (writer as unknown as Record<string, unknown>).write = vi.fn();
            (writer as unknown as Record<string, unknown>).end = vi.fn();
            (writer as unknown as Record<string, unknown>).destroy = vi.fn();
            (writer as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
            return writer;
        }),
        createReadStream: vi.fn().mockImplementation(() => {
            return new EventEmitter();
        }),
        default: {
            createWriteStream: vi.fn().mockImplementation(() => {
                const writer = new EventEmitter();
                (writer as unknown as Record<string, unknown>).write = vi.fn();
                (writer as unknown as Record<string, unknown>).end = vi.fn();
                (writer as unknown as Record<string, unknown>).destroy = vi.fn();
                (writer as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
                return writer;
            }),
            createReadStream: vi.fn().mockImplementation(() => {
                return new EventEmitter();
            })
        }
    };
});

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../config.js', () => ({
    CONFIG: {
        download: { bandwidthLimit: 0 }
    }
}));

describe('DownloadEngine', () => {
    let engine: DownloadEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new DownloadEngine();
    });

    it('should perform a clean download', async () => {
        const mockDataStream = new EventEmitter();
        (mockDataStream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
        (mockDataStream as unknown as Record<string, unknown>).destroy = vi.fn();

        vi.mocked(network.downloadFile).mockResolvedValue({
            status: 200,
            headers: { 'content-length': '1000' },
            data: mockDataStream
        } as unknown as AxiosResponse);

        const downloadPromise = engine.download(
            'url', 'path', 'id', { title: 'T' } as unknown as Metadata, 1000, 27
        );

        await vi.waitFor(() => {
            if (vi.mocked(fs.createWriteStream).mock.calls.length === 0) throw new Error('not called');
        });

        const writer = vi.mocked(fs.createWriteStream).mock.results[0].value;
        mockDataStream.emit('data', Buffer.alloc(1000));
        writer.emit('finish');

        const result = await downloadPromise;
        expect(result.size).toBe(1000);
    });

    it('should handle cancellation', async () => {
        const mockDataStream = new EventEmitter();
        (mockDataStream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
        (mockDataStream as unknown as Record<string, unknown>).destroy = vi.fn();

        vi.mocked(network.downloadFile).mockResolvedValue({
            status: 200,
            headers: { 'content-length': '1000' },
            data: mockDataStream
        } as unknown as AxiosResponse);

        let cancelled = false;
        const downloadPromise = engine.download(
            'url', 'path', 'id', { title: 'T' } as unknown as Metadata, 1000, 27, 
            undefined, () => cancelled
        );

        await vi.waitFor(() => {
            if (vi.mocked(fs.createWriteStream).mock.calls.length === 0) throw new Error('not called');
        });

        cancelled = true;
        mockDataStream.emit('data', Buffer.alloc(100));

        await expect(downloadPromise).rejects.toThrow('Cancelled by user');
    });

    it('should explain aborted streams as unavailable candidates', async () => {
        const mockDataStream = new EventEmitter();
        (mockDataStream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
        (mockDataStream as unknown as Record<string, unknown>).destroy = vi.fn();

        vi.mocked(network.downloadFile).mockResolvedValue({
            status: 200,
            headers: { 'content-length': '1000' },
            data: mockDataStream
        } as unknown as AxiosResponse);

        const downloadPromise = engine.download(
            'url',
            'path',
            'id',
            { title: 'T' } as unknown as Metadata,
            1000,
            27
        );

        await vi.waitFor(() => {
            if (vi.mocked(fs.createWriteStream).mock.calls.length === 0) throw new Error('not called');
        });

        mockDataStream.emit('aborted');

        await expect(downloadPromise).rejects.toThrow('selected Hi-Res candidate is likely unavailable');
    });

    it('should not resume when the recorded partial points at a different file', async () => {
        vi.mocked(resumeService.getPartial).mockReturnValue({
            trackId: 'id',
            filePath: 'some/other/file.flac',
            bytesDownloaded: 500,
            totalBytes: 1000,
            quality: 27,
            startedAt: new Date().toISOString()
        });
        vi.mocked(resumeService.canResume).mockReturnValue(true);
        vi.mocked(resumeService.getResumePosition).mockReturnValue(500);

        const mockDataStream = new EventEmitter();
        (mockDataStream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
        (mockDataStream as unknown as Record<string, unknown>).destroy = vi.fn();

        vi.mocked(network.downloadFile).mockResolvedValue({
            status: 200,
            headers: { 'content-length': '1000' },
            data: mockDataStream
        } as unknown as AxiosResponse);

        void engine.download('url', 'path', 'id', { title: 'T' } as unknown as Metadata, 1000, 27);

        await vi.waitFor(() => {
            if (vi.mocked(network.downloadFile).mock.calls.length === 0) {
                throw new Error('not called');
            }
        });

        // No Range header: the recorded offset belongs to another file, and
        // applying it here would append to the wrong place.
        const [, requestOptions] = vi.mocked(network.downloadFile).mock.calls[0]!;
        expect((requestOptions as { headers?: Record<string, string> })?.headers?.Range).toBeUndefined();
        expect(vi.mocked(fs.createReadStream)).not.toHaveBeenCalled();
    });

    it('should handle resume if possible', async () => {
        vi.mocked(resumeService.getPartial).mockReturnValue({
            trackId: 'id',
            filePath: 'path',
            bytesDownloaded: 500,
            totalBytes: 1000,
            quality: 27,
            startedAt: new Date().toISOString()
        });
        vi.mocked(resumeService.canResume).mockReturnValue(true);
        vi.mocked(resumeService.getResumePosition).mockReturnValue(500);

        const mockDataStream = new EventEmitter();
        (mockDataStream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
        (mockDataStream as unknown as Record<string, unknown>).destroy = vi.fn();

        vi.mocked(network.downloadFile).mockResolvedValue({
            status: 206,
            headers: { 'content-length': '500' },
            data: mockDataStream
        } as unknown as AxiosResponse);

        const downloadPromise = engine.download(
            'url', 'path', 'id', { title: 'T' } as unknown as Metadata, 1000, 27
        );

        // Wait for re-hashing to start
        await vi.waitFor(() => {
            if (vi.mocked(fs.createReadStream).mock.calls.length === 0) throw new Error('not called');
        });

        const reader = vi.mocked(fs.createReadStream).mock.results[0].value;
        reader.emit('data', Buffer.alloc(500));
        reader.emit('end');

        // Wait for writing to start
        await vi.waitFor(() => {
            if (vi.mocked(fs.createWriteStream).mock.calls.length === 0) throw new Error('not called');
        });

        const writer = vi.mocked(fs.createWriteStream).mock.results[0].value;
        mockDataStream.emit('data', Buffer.alloc(500));
        writer.emit('finish');

        const result = await downloadPromise;
        expect(result.size).toBe(1000);
        expect(network.downloadFile).toHaveBeenCalledWith(
            'url', 
            expect.objectContaining({ headers: { 'Range': 'bytes=500-' } })
        );
    });

    describe('stalled transfers', () => {
        const makeStream = () => {
            const stream = new EventEmitter();
            (stream as unknown as Record<string, unknown>).pipe = vi.fn().mockReturnThis();
            (stream as unknown as Record<string, unknown>).destroy = vi.fn();
            return stream;
        };

        // Settle into a value either way so the promise is never left unhandled
        // while fake timers are driving the clock.
        const begin = (stream: EventEmitter) => {
            vi.mocked(network.downloadFile).mockResolvedValue({
                status: 200,
                headers: { 'content-length': '1000' },
                data: stream
            } as unknown as AxiosResponse);

            return engine
                .download('url', 'path', 'id', { title: 'T' } as unknown as Metadata, 1000, 27)
                .then(
                    (ok) => ({ ok, err: undefined as Error | undefined }),
                    (err: Error) => ({ ok: undefined, err })
                );
        };

        // A socket that goes quiet emits no 'end', 'error' or 'aborted', so before
        // the idle timeout this promise never settled: the track hung forever and
        // its queue item held a slot in 'downloading' indefinitely.
        it('rejects a stream that stops delivering data', async () => {
            vi.useFakeTimers();
            try {
                const stream = makeStream();
                const settled = begin(stream);
                await vi.advanceTimersByTimeAsync(0);

                stream.emit('data', Buffer.alloc(100));
                await vi.advanceTimersByTimeAsync(61_000);

                const { err } = await settled;
                expect(err).toBeInstanceOf(Error);
                expect(err?.message).toMatch(/stalled/i);
            } finally {
                vi.useRealTimers();
            }
        });

        it('rejects a connection that never delivers a first byte', async () => {
            vi.useFakeTimers();
            try {
                const settled = begin(makeStream());
                await vi.advanceTimersByTimeAsync(0);

                await vi.advanceTimersByTimeAsync(61_000);

                const { err } = await settled;
                expect(err?.message).toMatch(/stalled/i);
            } finally {
                vi.useRealTimers();
            }
        });

        it('keeps a slow but progressing transfer alive', async () => {
            vi.useFakeTimers();
            try {
                const stream = makeStream();
                const settled = begin(stream);
                await vi.advanceTimersByTimeAsync(0);

                const writer = vi.mocked(fs.createWriteStream).mock.results.at(-1)!.value;

                // A chunk every 50s stays under the 60s limit, so the timer re-arms.
                for (let i = 0; i < 4; i++) {
                    stream.emit('data', Buffer.alloc(250));
                    await vi.advanceTimersByTimeAsync(50_000);
                }
                writer.emit('finish');
                await vi.advanceTimersByTimeAsync(0);

                const { ok, err } = await settled;
                expect(err).toBeUndefined();
                expect(ok?.size).toBe(1000);
            } finally {
                vi.useRealTimers();
            }
        });
    });
});
