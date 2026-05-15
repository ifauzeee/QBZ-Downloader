import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LibraryStatisticsService } from './LibraryStatisticsService.js';
import { databaseService } from './database/index.js';

// Mock dependencies
vi.mock('./database/index.js', () => ({
    databaseService: {
        getAllTracks: vi.fn().mockReturnValue([])
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        error: vi.fn()
    }
}));

describe('LibraryStatisticsService', () => {
    let service: LibraryStatisticsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new LibraryStatisticsService();
    });

    it('should calculate library stats correctly', async () => {
        const mockTracks = [
            { id: '1', title: 'T1', artist: 'A1', album: 'Alb1', quality: 27, file_size: 1000, genre: 'Rock' },
            { id: '2', title: 'T2', artist: 'A1', album: 'Alb1', quality: 6, file_size: 500, genre: 'Rock' },
            { id: '3', title: 'T3', artist: 'A2', album: 'Alb2', quality: 5, file_size: 200, genre: 'Pop' }
        ];
        vi.mocked(databaseService.getAllTracks).mockReturnValue(mockTracks as any);

        const stats = await service.getLibraryStats();

        expect(stats.totalTracks).toBe(3);
        expect(stats.totalArtists).toBe(2);
        expect(stats.totalAlbums).toBe(2);
        expect(stats.totalSize).toBe(1700);
        expect(stats.qualityDistribution).toEqual({
            'Hi-Res': 1,
            'FLAC': 1,
            'MP3': 1
        });
        expect(stats.genreDistribution).toEqual({
            'Rock': 2,
            'Pop': 1
        });
    });

    it('should calculate activity correctly for the last 30 days', async () => {
        const now = new Date().toISOString().split('T')[0];
        const mockTracks = [
            { id: '1', downloaded_at: `${now} 12:00:00` },
            { id: '2', downloaded_at: `${now} 13:00:00` }
        ];
        vi.mocked(databaseService.getAllTracks).mockReturnValue(mockTracks as any);

        const stats = await service.getLibraryStats();
        
        const todayActivity = stats.activity.find(a => a.date === now);
        expect(todayActivity?.count).toBe(2);
        expect(stats.activity.length).toBe(30);
    });

    it('should return correct labels for qualities', () => {
        expect((service as any).getQualityLabel(27)).toBe('Hi-Res');
        expect((service as any).getQualityLabel(6)).toBe('FLAC');
        expect((service as any).getQualityLabel(5)).toBe('MP3');
        expect((service as any).getQualityLabel(1)).toBe('Other');
    });
});
