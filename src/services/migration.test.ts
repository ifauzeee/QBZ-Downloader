import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MigrationService } from './migration.js';
import QobuzAPI from '../api/qobuz.js';
import { spotifyApi } from '../api/spotify.js';
import { downloadQueue } from './queue/queue.js';

// Mock dependencies
vi.mock('../api/spotify.js', () => ({
    spotifyApi: {
        extractId: vi.fn(),
        getPlaylistTracks: vi.fn(),
        getAlbumTracks: vi.fn(),
        getTrack: vi.fn()
    }
}));

vi.mock('../api/qobuz.js', () => {
    return {
        default: vi.fn().mockImplementation(function() {
            return {
                search: vi.fn().mockResolvedValue({
                    success: true,
                    data: {
                        tracks: {
                            items: [
                                { id: 'q1', title: 'Song Title', artist: { name: 'Artist Name' }, duration: 200 }
                            ]
                        }
                    }
                })
            };
        })
    };
});

vi.mock('./queue/queue.js', () => ({
    downloadQueue: {
        add: vi.fn()
    }
}));

vi.mock('../utils/limit.js', () => ({
    globalApiLimit: vi.fn((fn) => fn())
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

describe('MigrationService', () => {
    let service: MigrationService;
    let mockApi: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockApi = new QobuzAPI();
        service = new MigrationService(mockApi);
    });

    describe('Spotify Migration', () => {
        it('should migrate a Spotify playlist', async () => {
            vi.mocked(spotifyApi.extractId).mockReturnValue({ type: 'playlist', id: 'pl123' });
            vi.mocked(spotifyApi.getPlaylistTracks).mockResolvedValue([
                { id: 's1', title: 'Song Title', artist: 'Artist Name', duration_ms: 200000 }
            ]);

            const result = await service.migrateFromSpotify('https://spotify.com/playlist/pl123');

            expect(result.total).toBe(1);
            expect(result.found).toBe(1);
            expect(result.results[0].qobuzTrackId).toBe('q1');
            expect(mockApi.search).toHaveBeenCalled();
        });

        it('should handle track matches correctly based on score', () => {
            const sTrack = { title: 'Hello', artist: 'Adele', duration_ms: 295000 } as any;
            const qTrack = { title: 'Hello', artist: { name: 'Adele' }, duration: 295 } as any;
            
            const score = (service as any).calculateMatchScore(sTrack, qTrack);
            expect(score).toBeGreaterThan(0.9);
        });

        it('should start downloads for found tracks', async () => {
            const results = [
                { 
                    found: true, 
                    qobuzTrackId: 'q1', 
                    spotifyTrack: { title: 'S1', artist: 'A1' } as any,
                    matchScore: 1.0
                },
                { 
                    found: false, 
                    spotifyTrack: { title: 'S2', artist: 'A2' } as any,
                    matchScore: 0
                }
            ];

            const added = await service.startMigrationDownload(results, 27);
            expect(added).toBe(1);
            expect(downloadQueue.add).toHaveBeenCalledTimes(1);
            expect(downloadQueue.add).toHaveBeenCalledWith(
                'track', 
                'q1', 
                27, 
                expect.objectContaining({ title: 'S1' })
            );
        });
    });

    describe('Edge Cases', () => {
        it('should throw error for invalid Spotify URL', async () => {
            vi.mocked(spotifyApi.extractId).mockReturnValue(null);
            await expect(service.migrateFromSpotify('invalid')).rejects.toThrow('Invalid Spotify URL');
        });
    });
});
