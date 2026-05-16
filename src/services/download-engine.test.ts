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

    it('should handle resume if possible', async () => {
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
});
