import { describe, it, expect, beforeEach, vi } from 'vitest';
import { exec } from 'node:child_process';
import { QualityScannerService } from './QualityScannerService.js';
import { parseMeanVolume, scanQualityFile } from './QualityScannerWorker.js';
import { checkBinaryAvailability } from '../utils/binaries.js';

type ExecMockCallback = (err: Error | null, result: { stderr: string }) => void;

const { workerState } = vi.hoisted(() => ({
    workerState: {
        report: {
            isTrueLossless: true,
            confidence: 100,
            details: 'worker result'
        },
        options: undefined as { workerData?: { filePath?: string } } | undefined
    }
}));

vi.mock('node:worker_threads', () => {
    class MockWorker {
        private handlers = new Map<string, (value: unknown) => void>();

        constructor(_url: URL, options?: { workerData?: { filePath?: string } }) {
            workerState.options = options;
            setTimeout(() => {
                this.handlers.get('message')?.(workerState.report);
                this.handlers.get('exit')?.(0);
            }, 0);
        }

        once(event: string, callback: (value: unknown) => void): this {
            this.handlers.set(event, callback);
            return this;
        }
    }

    return {
        Worker: MockWorker,
        parentPort: null,
        workerData: {}
    };
});

vi.mock('node:child_process', () => ({
    exec: vi.fn((cmd: string, cb?: ExecMockCallback) => {
        if (cb) cb(null, { stderr: 'mean_volume: -50.0 dB' });
        return { on: vi.fn() } as unknown as ReturnType<typeof exec>;
    })
}));

vi.mock('node:fs', () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(true)
    },
    existsSync: vi.fn().mockReturnValue(true)
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

vi.mock('../utils/binaries.js', () => ({
    checkBinaryAvailability: vi.fn().mockResolvedValue({ available: true, path: 'ffmpeg' }),
    resolveBinaryPath: vi.fn().mockReturnValue('ffmpeg')
}));

describe('QualityScannerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        workerState.report = {
            isTrueLossless: true,
            confidence: 100,
            details: 'worker result'
        };
        workerState.options = undefined;
    });

    it('should scan files in a worker thread', async () => {
        const service = new QualityScannerService();

        const report = await service.scanFile('test.flac');

        expect(report).toEqual(workerState.report);
        expect(workerState.options?.workerData?.filePath).toBe('test.flac');
    });

    it('should identify true lossless files', async () => {
        vi.mocked(exec).mockImplementation(((cmd: string, cb?: ExecMockCallback) => {
            if (cb) cb(null, { stderr: 'mean_volume: -30.0 dB' });
            return { on: vi.fn() } as unknown as ReturnType<typeof exec>;
        }) as unknown as typeof exec);

        const report = await scanQualityFile('test.flac');
        expect(report.isTrueLossless).toBe(true);
        expect(report.confidence).toBe(100);
    });

    it('should detect fake lossless (16kHz cutoff)', async () => {
        vi.mocked(exec).mockImplementation(((cmd: string, cb?: ExecMockCallback) => {
            if (cb) {
                if (cmd.includes('f=16000')) {
                    cb(null, { stderr: 'mean_volume: -85.0 dB' });
                } else {
                    cb(null, { stderr: 'mean_volume: -95.0 dB' });
                }
            }
            return { on: vi.fn() } as unknown as ReturnType<typeof exec>;
        }) as unknown as typeof exec);

        const report = await scanQualityFile('fake.flac');
        expect(report.isTrueLossless).toBe(false);
        expect(report.cutoffFrequency).toBe(16000);
    });

    it('should detect likely upsampled files (20kHz cutoff)', async () => {
        vi.mocked(exec).mockImplementation(((cmd: string, cb?: ExecMockCallback) => {
            if (cb) {
                if (cmd.includes('f=16000')) {
                    cb(null, { stderr: 'mean_volume: -50.0 dB' });
                } else {
                    cb(null, { stderr: 'mean_volume: -90.0 dB' });
                }
            }
            return { on: vi.fn() } as unknown as ReturnType<typeof exec>;
        }) as unknown as typeof exec);

        const report = await scanQualityFile('upsampled.flac');
        expect(report.isTrueLossless).toBe(false);
        expect(report.cutoffFrequency).toBe(20000);
    });

    it('should handle missing FFmpeg gracefully', async () => {
        vi.mocked(checkBinaryAvailability).mockResolvedValueOnce({ available: false, path: '' });

        const report = await scanQualityFile('test.flac');
        expect(report.confidence).toBe(0);
        expect(report.details).toContain('FFmpeg not installed');
    });

    describe('parseMeanVolume', () => {
        it('should correctly parse volume from ffmpeg output', () => {
            const output = '... [volumedetect] mean_volume: -45.2 dB ...';
            expect(parseMeanVolume(output)).toBe(-45.2);
        });

        it('should return -100 if no volume found', () => {
            expect(parseMeanVolume('garbage')).toBe(-100);
        });
    });
});
