import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryHealerService } from './LibraryHealerService.js';
import { databaseService } from './database/index.js';
import { aiMetadataService } from './AIMetadataService.js';
import fs from 'fs';

// Mock dependencies
vi.mock('fs', () => {
    const mockPromises = {
        access: vi.fn(),
        readdir: vi.fn(),
        stat: vi.fn()
    };
    return {
        promises: mockPromises,
        existsSync: vi.fn().mockReturnValue(true),
        default: {
            promises: mockPromises,
            existsSync: vi.fn().mockReturnValue(true)
        }
    };
});

vi.mock('./database/index.js', () => ({
    databaseService: {
        getAllTracks: vi.fn().mockReturnValue([]),
        updateTrackPath: vi.fn(),
        updateTrackMetadata: vi.fn()
    }
}));

vi.mock('./AIMetadataService.js', () => ({
    aiMetadataService: {
        repairMetadata: vi.fn()
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

vi.mock('../config.js', () => ({
    CONFIG: {
        download: { outputDir: '/downloads' },
        ai: { enabled: true }
    }
}));

describe('LibraryHealerService', () => {
    let service: LibraryHealerService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LibraryHealerService();
    });

    it('should report missing files if they cannot be found', async () => {
        const track = { id: 't1', title: 'T1', file_path: '/missing/p1.flac' };
        vi.mocked(databaseService.getAllTracks).mockReturnValue([track as any]);
        vi.mocked(fs.promises.access).mockRejectedValue(new Error('no access'));
        vi.mocked(fs.promises.readdir).mockResolvedValue([]);

        const report = await service.performFullHeal();
        expect(report.missing).toBe(1);
        expect(report.fixed).toBe(0);
    });

    it('should relocate files if found in a different subdirectory', async () => {
        const track = { id: 't1', title: 'T1', file_path: '/old/p1.flac' };
        vi.mocked(databaseService.getAllTracks).mockReturnValue([track as any]);
        vi.mocked(fs.promises.access).mockRejectedValue(new Error('no access'));
        
        // Mock recursive search
        vi.mocked(fs.promises.readdir).mockResolvedValueOnce(['subdir'] as any);
        vi.mocked(fs.promises.stat).mockResolvedValueOnce({ isDirectory: () => true } as any);
        vi.mocked(fs.promises.readdir).mockResolvedValueOnce(['p1.flac'] as any);
        vi.mocked(fs.promises.stat).mockResolvedValueOnce({ isDirectory: () => false } as any);

        const report = await service.performFullHeal();
        expect(report.fixed).toBe(1);
        expect(databaseService.updateTrackPath).toHaveBeenCalledWith('t1', expect.stringContaining('p1.flac'));
    });

    it('should repair metadata via AI if enabled and missing', async () => {
        const track = { id: 't1', title: 'T1', artist: 'A1', file_path: '/ok/p1.flac', genre: 'Unknown' };
        vi.mocked(databaseService.getAllTracks).mockReturnValue([track as any]);
        vi.mocked(fs.promises.access).mockResolvedValue(undefined); // File exists
        
        vi.mocked(aiMetadataService.repairMetadata).mockResolvedValue({ genre: 'Rock' });

        const report = await service.performFullHeal();
        expect(report.fixed).toBe(1);
        expect(databaseService.updateTrackMetadata).toHaveBeenCalledWith('t1', { genre: 'Rock' });
    });
});
