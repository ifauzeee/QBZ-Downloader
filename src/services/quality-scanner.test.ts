import { describe, it, expect, vi, beforeEach } from 'vitest';
import { qualityScannerService } from './QualityScannerService.js';
import { exec } from 'child_process';
import fs from 'fs';
import * as binaries from '../utils/binaries.js';

vi.mock('child_process', () => ({
    exec: vi.fn()
}));

vi.mock('fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('fs')>();
    return {
        ...actual,
        default: {
            ...actual,
            existsSync: vi.fn()
        }
    };
});


vi.mock('../utils/binaries.js', () => ({
    checkBinaryAvailability: vi.fn(),
    resolveBinaryPath: vi.fn()
}));

describe('QualityScannerService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset static state if possible, though it's private.
        // We'll rely on the mocks to return consistent values.
        (qualityScannerService as any).constructor.ffmpegAvailable = null;
    });

    it('should return inconclusive if FFmpeg is not available', async () => {
        vi.mocked(binaries.checkBinaryAvailability).mockResolvedValue({ available: false, path: '' });
        
        const result = await qualityScannerService.scanFile('test.flac');
        expect(result.details).toContain('FFmpeg not installed');
        expect(result.confidence).toBe(0);
    });

    it('should flag as fake lossless if 16kHz cutoff is detected', async () => {
        vi.mocked(binaries.checkBinaryAvailability).mockResolvedValue({ available: true, path: 'ffmpeg' });
        vi.mocked(binaries.resolveBinaryPath).mockReturnValue('ffmpeg');
        vi.mocked(fs.existsSync).mockReturnValue(true);

        // Mock exec response for 16k and 20k
        // 16kHz mean_volume < -80 means fake
        const mockExec = vi.mocked(exec);
        mockExec.mockImplementation((cmd, callback: any) => {
            if (cmd.includes('f=16000')) {
                callback(null, { stderr: 'mean_volume: -85.5 dB' });
            } else {
                callback(null, { stderr: 'mean_volume: -90.0 dB' });
            }
            return {} as any;
        });

        const result = await qualityScannerService.scanFile('test.flac');
        expect(result.isTrueLossless).toBe(false);
        expect(result.details).toContain('16kHz detected');
        expect(result.cutoffFrequency).toBe(16000);
    });

    it('should flag as likely upsampled if 20kHz roll-off is detected', async () => {
        vi.mocked(binaries.checkBinaryAvailability).mockResolvedValue({ available: true, path: 'ffmpeg' });
        vi.mocked(binaries.resolveBinaryPath).mockReturnValue('ffmpeg');
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const mockExec = vi.mocked(exec);
        mockExec.mockImplementation((cmd, callback: any) => {
            if (cmd.includes('f=16000')) {
                callback(null, { stderr: 'mean_volume: -20.0 dB' }); // Plenty of signal at 16k
            } else {
                callback(null, { stderr: 'mean_volume: -87.0 dB' }); // Low signal at 20k
            }
            return {} as any;
        });

        const result = await qualityScannerService.scanFile('test.flac');
        expect(result.isTrueLossless).toBe(false);
        expect(result.details).toContain('20kHz detected');
        expect(result.cutoffFrequency).toBe(20000);
    });

    it('should return true lossless if high frequencies are strong', async () => {
        vi.mocked(binaries.checkBinaryAvailability).mockResolvedValue({ available: true, path: 'ffmpeg' });
        vi.mocked(binaries.resolveBinaryPath).mockReturnValue('ffmpeg');
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const mockExec = vi.mocked(exec);
        mockExec.mockImplementation((cmd, callback: any) => {
            callback(null, { stderr: 'mean_volume: -25.0 dB' }); // Strong signal in both
            return {} as any;
        });

        const result = await qualityScannerService.scanFile('test.flac');
        expect(result.isTrueLossless).toBe(true);
        expect(result.confidence).toBe(100);
    });

    it('should return inconclusive if FFmpeg analysis fails', async () => {
        vi.mocked(binaries.checkBinaryAvailability).mockResolvedValue({ available: true, path: 'ffmpeg' });
        vi.mocked(binaries.resolveBinaryPath).mockReturnValue('ffmpeg');
        vi.mocked(fs.existsSync).mockReturnValue(true);

        const mockExec = vi.mocked(exec);
        mockExec.mockImplementation((cmd, callback: any) => {
            callback(null, { stderr: 'some other output' }); // No mean_volume
            return {} as any;
        });

        const result = await qualityScannerService.scanFile('test.flac');
        expect(result.isTrueLossless).toBe(true);
        expect(result.confidence).toBe(50);
        expect(result.details).toContain('inconclusive');
    });
});
