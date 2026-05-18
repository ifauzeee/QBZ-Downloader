import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResumeService, BatchImportService } from './batch.js';
import { downloadQueue } from './queue/queue.js';
import { inputValidator } from '../utils/validator.js';
import fs from 'fs';
import path from 'path';
// import { EventEmitter } from 'events';

// Mock dependencies
vi.mock('fs', async () => {
    const { EventEmitter } = await import('events');
    const fsMock = {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue('{}'),
        writeFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        createWriteStream: vi.fn().mockReturnValue(new EventEmitter()),
        statSync: vi.fn().mockReturnValue({ size: 100 }),
        lstatSync: vi.fn().mockReturnValue({
            isFile: () => true,
            mtimeMs: Date.now()
        }),
        readdirSync: vi.fn().mockReturnValue([]),
        unlinkSync: vi.fn(),
        rmdirSync: vi.fn()
    };

    return {
        ...fsMock,
        default: fsMock
    };
});

vi.mock('archiver', () => {
    const archiverMock = vi.fn().mockImplementation(() => {
        let output: { emit?: (event: string) => void } | undefined;
        return {
            on: vi.fn(),
            pipe: vi.fn((target) => {
                output = target;
            }),
            file: vi.fn(),
            finalize: vi.fn().mockImplementation(async () => {
                output?.emit?.('close');
            }),
            pointer: vi.fn().mockReturnValue(1234)
        };
    });
    return {
        default: archiverMock,
        archiver: archiverMock
    };
});


vi.mock('./queue/queue.js', async () => {
    const { EventEmitter } = await import('events');
    const emitter = new EventEmitter();
    (emitter as unknown as { add: unknown }).add = vi.fn();
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
        vi.mocked(fs.statSync).mockReturnValue({ size: 500 } as unknown as fs.Stats);

        expect(service.canResume('t1')).toBe(true);
        expect(service.getResumePosition('t1')).toBe(500);
    });

    it('should return false if file is missing or complete', () => {
        service.startDownload('t1', 'p1.flac', 1000, 27);
        vi.mocked(fs.existsSync).mockReturnValue(false);
        expect(service.canResume('t1')).toBe(false);

        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.statSync).mockReturnValue({ size: 1000 } as unknown as fs.Stats);
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
            metadata: { batchId: Array.from((service as unknown as { activeBatches: Map<string, unknown> }).activeBatches.keys())[0] },
            filePath: 'file.flac'
        });
        downloadQueue.emit('item:completed', { 
            metadata: { batchId: Array.from((service as unknown as { activeBatches: Map<string, unknown> }).activeBatches.keys())[0] },
            filePath: 'file2.flac'
        });

        // FinalizeBatch should have been called
        await new Promise(r => setTimeout(r, 10));
        expect((service as unknown as { activeBatches: Map<string, unknown> }).activeBatches.size).toBe(0);

    });

    it('should remove generated batch files and empty folders after ZIP creation', async () => {
        const createdAt = Date.now();
        vi.mocked(fs.existsSync).mockImplementation((target) => {
            const value = String(target);
            return value.includes('01. Song.flac') || value.includes('01. Song.lrc');
        });
        vi.mocked(fs.lstatSync).mockReturnValue({
            isFile: () => true,
            isDirectory: () => false,
            mtimeMs: createdAt
        } as unknown as fs.Stats);
        vi.mocked(fs.readdirSync).mockReturnValue([]);

        const batch = {
            id: 'batch-1',
            total: 1,
            completed: 1,
            failed: 0,
            files: ['/downloads/Artist/Album/01. Song.flac'],
            createdAt
        };
        const internals = service as unknown as {
            collectBatchArtifacts: (batch: typeof batch, downloadDir: string) => Array<{
                filePath: string;
                archiveName: string;
                cleanup: boolean;
            }>;
            cleanupBatchArtifacts: (
                artifacts: Array<{ filePath: string; archiveName: string; cleanup: boolean }>,
                downloadDir: string
            ) => void;
        };

        const artifacts = internals.collectBatchArtifacts(batch, path.resolve('/downloads'));
        expect(artifacts.map((artifact) => artifact.archiveName)).toEqual([
            path.join('Artist', 'Album', '01. Song.flac'),
            path.join('Artist', 'Album', '01. Song.lrc')
        ]);

        internals.cleanupBatchArtifacts(artifacts, path.resolve('/downloads'));

        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('01. Song.flac'));
        expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('01. Song.lrc'));
        expect(fs.rmdirSync).toHaveBeenCalledWith(expect.stringContaining('Album'));
        expect(fs.rmdirSync).toHaveBeenCalledWith(expect.stringContaining('Artist'));
    });
});
