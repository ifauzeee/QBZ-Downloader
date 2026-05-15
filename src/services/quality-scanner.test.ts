import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QualityScannerService } from './QualityScannerService.js';
import { exec } from 'child_process';
import fs from 'fs';
import { checkBinaryAvailability } from '../utils/binaries.js';

// Mock dependencies
vi.mock('child_process', () => ({
    exec: vi.fn((cmd, cb) => cb(null, { stderr: 'mean_volume: -50.0 dB' }))
}));

vi.mock('fs', () => ({
    existsSync: vi.fn().mockReturnValue(true),
    default: {
        existsSync: vi.fn().mockReturnValue(true)
    }
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
    let service: QualityScannerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new QualityScannerService();
        // Reset static flags
        (QualityScannerService as any).ffmpegAvailable = null;
        (QualityScannerService as any).ffmpegPath = null;
    });

    it('should identify true lossless files', async () => {
        // Mock ffmpeg output showing high energy above thresholds
        vi.mocked(exec).mockImplementation((cmd, cb: any) => {
            cb(null, { stderr: 'mean_volume: -30.0 dB' });
        });

        const report = await service.scanFile('test.flac');
        expect(report.isTrueLossless).toBe(true);
        expect(report.confidence).toBe(100);
    });

    it('should detect fake lossless (16kHz cutoff)', async () => {
        // Mock ffmpeg output showing very low energy above 16kHz
        vi.mocked(exec).mockImplementation((cmd, cb: any) => {
            if (cmd.includes('f=16000')) {
                cb(null, { stderr: 'mean_volume: -85.0 dB' });
            } else {
                cb(null, { stderr: 'mean_volume: -95.0 dB' });
            }
        });

        const report = await service.scanFile('fake.flac');
        expect(report.isTrueLossless).toBe(false);
        expect(report.cutoffFrequency).toBe(16000);
    });

    it('should detect likely upsampled files (20kHz cutoff)', async () => {
        // Mock ffmpeg output: 16k is fine (-50), 20k is low (-90)
        vi.mocked(exec).mockImplementation((cmd, cb: any) => {
            if (cmd.includes('f=16000')) {
                cb(null, { stderr: 'mean_volume: -50.0 dB' });
            } else {
                cb(null, { stderr: 'mean_volume: -90.0 dB' });
            }
        });

        const report = await service.scanFile('upsampled.flac');
        expect(report.isTrueLossless).toBe(false);
        expect(report.cutoffFrequency).toBe(20000);
    });

    it('should handle missing FFmpeg gracefully', async () => {
        vi.mocked(checkBinaryAvailability).mockResolvedValueOnce({ available: false, path: '' });
        
        const report = await service.scanFile('test.flac');
        expect(report.confidence).toBe(0);
        expect(report.details).toContain('FFmpeg not installed');
    });

    describe('parseMeanVolume', () => {
        it('should correctly parse volume from ffmpeg output', () => {
            const output = '... [volumedetect] mean_volume: -45.2 dB ...';
            expect((service as any).parseMeanVolume(output)).toBe(-45.2);
        });

        it('should return -100 if no volume found', () => {
            expect((service as any).parseMeanVolume('garbage')).toBe(-100);
        });
    });
});
