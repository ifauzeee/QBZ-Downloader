import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResumeService, BatchImportService } from './batch.js';
import { downloadQueue } from './queue/queue.js';
import { inputValidator } from '../utils/validator.js';
import fs from 'fs';
import path from 'path';

// Mock dependencies
vi.mock('fs', () => {
    const { EventEmitter } = require('events');
    return {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue('{}'),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        createWriteStream: vi.fn().mockReturnValue(new EventEmitter()),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        default: {
            existsSync: vi.fn().mockReturnValue(false),
            readFileSync: vi.fn().mockReturnValue('{}'),
            writeFileSync: vi.fn(),
            mkdirSync: vi.fn(),
            createWriteStream: vi.fn().mockReturnValue(new EventEmitter()),
            statSync: vi.fn().mockReturnValue({ size: 100 })
        }
    };
});

vi.mock('archiver', () => {
    const archiverMock = vi.fn().mockReturnValue({
        on: vi.fn(),
        pipe: vi.fn(),
        file: vi.fn(),
        finalize: vi.fn().mockResolvedValue(undefined),
        pointer: vi.fn().mockReturnValue(1234)
    });
    return {
        default: archiverMock,
        archiver: archiverMock
    };
});


vi.mock('./queue/queue.js', () => {
    const { EventEmitter } = require('events');
    const emitter = new EventEmitter();
    (emitter as any).add = vi.fn();
    return {
        downloadQueue: emitter
    };
});

vi.mock('../utils/validator.js', () => ({
    inputValidator: {
        validateUrl: vi.fn()
    }
}));

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
        download: { outputDir: '/downloads' }
    }
}));

describe('ResumeService', () => {
    let service: ResumeService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ResumeService('/tmp/resume.json');
    });

    it('should start and track downloads', () => {
        service.startDownload('t1', 'p1.flac', 1000, 27);
        expect(service.getPartial('t1')).toBeDefined();
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('should determine if a download can be resumed', () => {
        service.startDownload('t1', 'p1.flac', 1000, 27);
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 500 } as any);

        expect(service.canResume('t1')).toBe(true);
        expect(service.getResumePosition('t1')).toBe(500);
    });

    it('should return false if file is missing or complete', () => {
        service.startDownload('t1', 'p1.flac', 1000, 27);
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(service.canResume('t1')).toBe(false);

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as any);
        expect(service.canResume('t1')).toBe(false);
    });
});

describe('BatchImportService', () => {
    let service: BatchImportService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BatchImportService();
    });

    it('should import URLs from a plain text file', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('http://qobuz.com/track/1\nhttp://qobuz.com/track/2');
        vi.mocked(inputValidator.validateUrl).mockReturnValue({ valid: true, type: 'track', id: '1' });

        const result = await service.importFromFile('list.txt');
        expect(result.imported).toBe(2);
        expect(downloadQueue.add).toHaveBeenCalledTimes(2);
    });

    it('should import from a CSV file', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.readFileSync).mockReturnValue('url,quality\nhttp://qobuz.com/track/1,27\nhttp://qobuz.com/track/2,6');
        vi.mocked(inputValidator.validateUrl).mockReturnValue({ valid: true, type: 'track', id: '1' });

        const result = await service.importFromCsv('list.csv');
        expect(result.imported).toBe(2);
    });

    it('should handle ZIP creation on batch completion', async () => {
        const batchUrls = ['url1', 'url2'];
        vi.mocked(inputValidator.validateUrl).mockReturnValue({ valid: true, type: 'track', id: '1' });
        
        await service.importUrls(batchUrls, 27, true);
        
        // Simulate all items completed
        downloadQueue.emit('item:completed', { 
            metadata: { batchId: Array.from((service as any).activeBatches.keys())[0] },
            filePath: 'file.flac'
        });
        downloadQueue.emit('item:completed', { 
            metadata: { batchId: Array.from((service as any).activeBatches.keys())[0] },
            filePath: 'file2.flac'
        });

        // FinalizeBatch should have been called
        await new Promise(r => setTimeout(r, 10));
        expect((service as any).activeBatches.size).toBe(0);

    });
});
