import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FormatConverterService } from './FormatConverterService.js';
import { exec } from 'child_process';
import * as fs from 'fs';
import { checkBinaryAvailability } from '../utils/binaries.js';
import { CONFIG } from '../config.js';

// Mock dependencies
vi.mock('child_process', () => ({
    exec: vi.fn((cmd, cb) => cb(null, { stdout: '', stderr: '' }))
}));

vi.mock('fs', () => {
    const mockFs = {
        existsSync: vi.fn().mockReturnValue(false),
        mkdirSync: vi.fn(),
        unlinkSync: vi.fn()
    };
    return {
        ...mockFs,
        default: mockFs
    };
});

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

vi.mock('../config.js', () => ({
    CONFIG: {
        export: {
            enabled: true,
            format: 'mp3',
            bitrate: '320k',
            outputDir: '',
            keepOriginal: true
        }
    }
}));

describe('FormatConverterService', () => {
    let service: FormatConverterService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new FormatConverterService();
        CONFIG.export.enabled = true;
        CONFIG.export.keepOriginal = true;
        vi.mocked(fs.existsSync).mockReturnValue(false);
    });

    it('should skip conversion if disabled', async () => {
        CONFIG.export.enabled = false;
        const result = await service.convert('test.flac');
        expect(result).toBeNull();
    });

    it('should skip conversion if input is not FLAC', async () => {
        const result = await service.convert('test.mp3');
        expect(result).toBeNull();
    });

    it('should perform conversion using ffmpeg', async () => {
        const result = await service.convert('input.flac');
        
        expect(result).toBeDefined();
        expect(result).toContain('input.mp3');
        expect(exec).toHaveBeenCalled();
    });

    it('should remove original file if keepOriginal is false', async () => {
        CONFIG.export.keepOriginal = false;
        
        await service.convert('input.flac');
        expect(fs.unlinkSync).toHaveBeenCalledWith('input.flac');
    });

    it('should skip if output file already exists', async () => {
        vi.mocked(fs.existsSync).mockReturnValue(true);
        const result = await service.convert('input.flac');
        expect(exec).not.toHaveBeenCalled();
        expect(result).toBeDefined();
    });

    it('should report availability correctly', async () => {
        const available = await service.isAvailable();
        expect(available).toBe(true);
        expect(checkBinaryAvailability).toHaveBeenCalledWith('ffmpeg');
    });
});
