import { databaseService } from './database/index.js';
import { logger } from '../utils/logger.js';

export interface LibraryStats {
    totalTracks: number;
    totalAlbums: number;
    totalArtists: number;
    totalSize: number;
    qualityDistribution: Record<string, number>;
    genreDistribution: Record<string, number>;
    activity: {
        date: string;
        count: number;
    }[];
}

export class LibraryStatisticsService {
    async getLibraryStats(): Promise<LibraryStats> {
        try {
            const tracks = databaseService.getAllTracks();
            
            const stats: LibraryStats = {
                totalTracks: tracks.length,
                totalAlbums: new Set(tracks.map(t => t.album)).size,
                totalArtists: new Set(tracks.map(t => t.artist)).size,
                totalSize: tracks.reduce((acc, t) => acc + (t.file_size || 0), 0),
                qualityDistribution: {},
                genreDistribution: {},
                activity: []
            };

            for (const track of tracks) {
                const qName = this.getQualityLabel(track.quality);
                stats.qualityDistribution[qName] = (stats.qualityDistribution[qName] || 0) + 1;

                if (track.genre) {
                    stats.genreDistribution[track.genre] = (stats.genreDistribution[track.genre] || 0) + 1;
                }
            }

            stats.activity = this.calculateActivity(tracks);

            return stats;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Statistics: Failed to calculate stats: ${message}`, 'STATS');
            throw error;
        }
    }

    private getQualityLabel(quality: number): string {
        if (quality >= 7) return 'Hi-Res';
        if (quality === 6) return 'FLAC';
        if (quality === 5) return 'MP3';
        return 'Other';
    }

    private calculateActivity(tracks: { created_at?: string }[]): { date: string; count: number }[] {
        const activityMap = new Map<string, number>();
        const now = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            activityMap.set(d.toISOString().split('T')[0], 0);
        }

        for (const track of tracks) {
            if (track.created_at) {
                const date = track.created_at.split(' ')[0];
                if (activityMap.has(date)) {
                    activityMap.set(date, (activityMap.get(date) || 0) + 1);
                }
            }
        }

        return Array.from(activityMap.entries()).map(([date, count]) => ({ date, count }));
    }
}

export const libraryStatisticsService = new LibraryStatisticsService();
