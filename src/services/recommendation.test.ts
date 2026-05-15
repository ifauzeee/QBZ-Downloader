import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationService } from './RecommendationService.js';
import QobuzAPI from '../api/qobuz.js';
import { historyService } from './history.js';

// Mock dependencies
vi.mock('../api/qobuz.js', () => {
    return {
        default: vi.fn().mockImplementation(function() {
            return {
                search: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        artists: { items: [{ id: 'art1' }] },
                        albums: { items: [{ id: 'alb_gen', title: 'General Album', hires: true }] }
                    }
                }),
                getArtist: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        albums: { items: [{ id: 'alb_art1', title: 'Artist Album', hires: true }] }
                    }
                })
            };
        })
    };
});

vi.mock('./history.js', () => ({
    historyService: {
        getSorted: vi.fn().mockReturnValue([])
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        error: vi.fn()
    }
}));

describe('RecommendationService', () => {
    let service: RecommendationService;
    let mockApi: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApi = new QobuzAPI();
        service = new RecommendationService(mockApi);
    });

    it('should return general recommendations when history is empty', async () => {
        vi.mocked(historyService.getSorted).mockReturnValue([]);
        
        const recs = await service.getRecommendations(5);
        expect(recs.length).toBeGreaterThan(0);
        expect(recs[0].title).toBe('General Album');
        expect(mockApi.search).toHaveBeenCalledWith('Hi-Res', 'albums', 5);
    });

    it('should return artist-based recommendations from history', async () => {
        vi.mocked(historyService.getSorted).mockReturnValue([
            { id: '1', artist: 'Favorite Artist', downloadedAt: '2023-01-01' } as any
        ]);

        const recs = await service.getRecommendations(5);
        expect(recs.length).toBeGreaterThan(0);
        expect(recs[0].title).toBe('Artist Album');
        expect(mockApi.search).toHaveBeenCalledWith('Favorite Artist', 'artists', 1);
        expect(mockApi.getArtist).toHaveBeenCalledWith('art1', 0, 10);
    });

    it('should fall back to general recommendations if artist results are insufficient', async () => {
        vi.mocked(historyService.getSorted).mockReturnValue([
            { id: '1', artist: 'Artist A', downloadedAt: '2023-01-01' } as any
        ]);
        
        // Mock artist details to return no albums
        vi.mocked(mockApi.getArtist).mockResolvedValue({
            success: true,
            data: { albums: { items: [] } }
        });

        const recs = await service.getRecommendations(5);
        expect(recs[0].title).toBe('General Album');
    });
});
