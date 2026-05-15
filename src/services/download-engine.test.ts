import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DownloadEngine } from './DownloadEngine.js';
import { downloadFile } from '../utils/network.js';
import { resumeService } from './batch.js';
import { EventEmitter } from 'events';
import fs from 'fs';
import { PassThrough } from 'stream';

vi.mock('../utils/network.js');
vi.mock('./batch.js', () => ({
    resumeService: {
        canResume: vi.fn().mockReturnValue(false),
        getResumePosition: vi.fn().mockReturnValue(0),
        startDownload: vi.fn(),
        updateProgress: vi.fn()
    }
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    const mockWriteStream = vi.fn(() => {
        const ps = new PassThrough();
        Object.defineProperty(ps, 'closed', {
            get: () => (ps as any)._closed || false,
            set: (v) => { (ps as any)._closed = v; },
            configurable: true
        });
        return ps;
    });
    const mockReadStream = vi.fn(() => new PassThrough());
    
    return {
        ...actual,
        createWriteStream: mockWriteStream,
        createReadStream: mockReadStream,
        default: {
            ...actual,
            createWriteStream: mockWriteStream,
            createReadStream: mockReadStream
        }
    };
});




describe('DownloadEngine', () => {
    let engine: DownloadEngine;

    beforeEach(() => {
        vi.clearAllMocks();
        engine = new DownloadEngine();
    });

    it('should perform a fresh download successfully', async () => {
        const mockResponse = {
            status: 200,
            headers: { 'content-length': '100' },
            data: new PassThrough()
        };
        vi.mocked(downloadFile).mockResolvedValue(mockResponse as any);

        const onProgress = vi.fn();
        const downloadPromise = engine.download(
            'http://example.com/track.flac',
            'test.flac',
            '123',
            { title: 'Test' } as any,
            100,
            27,
            onProgress
        );

        // Simulate data flowing
        mockResponse.data.write(Buffer.alloc(50));
        mockResponse.data.write(Buffer.alloc(50));
        mockResponse.data.end();

        const result = await downloadPromise;

        expect(result.size).toBe(100);
        expect(downloadFile).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ headers: {} }));
        expect(resumeService.startDownload).toHaveBeenCalledWith('123', 'test.flac', 100, 27);
    });

    it('should resume download if possible', async () => {
        vi.mocked(resumeService.canResume).mockReturnValue(true);
        vi.mocked(resumeService.getResumePosition).mockReturnValue(50);
        
        const mockResponse = {
            status: 206,
            headers: { 'content-length': '50' },
            data: new PassThrough()
        };
        vi.mocked(downloadFile).mockResolvedValue(mockResponse as any);

        // We need to mock createReadStream to handle the re-hashing of the first 50 bytes
        const mockReadStream = new PassThrough();
        vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream as any);

        const downloadPromise = engine.download(
            'http://example.com/track.flac',
            'test.flac',
            '123',
            { title: 'Test' } as any,
            100,
            27
        );

        // Simulate re-hashing finish
        mockReadStream.write(Buffer.alloc(50));
        mockReadStream.end();

        // Simulate new data
        mockResponse.data.write(Buffer.alloc(50));
        mockResponse.data.end();

        const result = await downloadPromise;

        expect(result.size).toBe(100);
        expect(downloadFile).toHaveBeenCalledWith(
            expect.any(String), 
            expect.objectContaining({ headers: { 'Range': 'bytes=50-' } })
        );
    });

    it('should handle cancellation correctly', async () => {
        const mockResponse = {
            status: 200,
            headers: { 'content-length': '100' },
            data: new PassThrough()
        };
        vi.mocked(downloadFile).mockResolvedValue(mockResponse as any);

        let cancelled = false;
        const isCancelled = () => cancelled;

        const downloadPromise = engine.download(
            'http://example.com/track.flac',
            'test.flac',
            '123',
            { title: 'Test' } as any,
            100,
            27,
            undefined,
            isCancelled
        );

        mockResponse.data.write(Buffer.alloc(10));
        cancelled = true;
        mockResponse.data.write(Buffer.alloc(10));

        await expect(downloadPromise).rejects.toThrow('Cancelled by user');
    });
});
