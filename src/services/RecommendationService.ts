import QobuzAPI from '../api/qobuz.js';
import { historyService } from './history.js';
import { Album } from '../types/qobuz.js';
import { logger } from '../utils/logger.js';

export class RecommendationService {
    private api: QobuzAPI;

    constructor(api: QobuzAPI) {
        this.api = api;
    }

    async getRecommendations(limit = 10): Promise<Album[]> {
        try {
            const history = historyService.getSorted();
            if (history.length === 0) {
                return this.getGeneralRecommendations(limit);
            }


            const artistCounts: Record<string, number> = {};
            history.forEach(entry => {
                if (entry.artist) {
                    artistCounts[entry.artist] = (artistCounts[entry.artist] || 0) + 1;
                }
            });

            const topArtists = Object.entries(artistCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 3)
                .map(([name]) => name);


            const recommendations: Album[] = [];
            const seenAlbumIds = new Set<string | number>();

            history.forEach(entry => {
            });

            for (const artistName of topArtists) {
                const searchRes = await this.api.search(artistName, 'artists', 1);
                if (searchRes.success && searchRes.data?.artists?.items?.length) {
                    const artist = searchRes.data.artists.items[0];
                    

                    const artistDetails = await this.api.getArtist(artist.id, 0, 10);
                    if (artistDetails.success && (artistDetails.data as any)?.albums?.items) {
                        const albums = (artistDetails.data as any).albums.items as Album[];
                        
                        for (const album of albums) {
                            if (!seenAlbumIds.has(album.id) && recommendations.length < limit) {
                                if (album.hires) {
                                    recommendations.push(album);
                                    seenAlbumIds.add(album.id);
                                }
                            }
                        }
                    }
                }
            }


            if (recommendations.length < limit) {
                const extra = await this.getGeneralRecommendations(limit - recommendations.length);
                extra.forEach(album => {
                    if (!seenAlbumIds.has(album.id) && recommendations.length < limit) {
                        recommendations.push(album);
                        seenAlbumIds.add(album.id);
                    }
                });
            }

            return recommendations;

        } catch (error: any) {
            logger.error(`RecommendationService: Failed to get recommendations: ${error.message}`);
            return [];
        }
    }

    private async getGeneralRecommendations(limit: number): Promise<Album[]> {
        const res = await this.api.search('Hi-Res', 'albums', limit);
        return res.success && res.data?.albums?.items ? res.data.albums.items : [];
    }
}
