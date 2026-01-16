import { databaseService } from '../database/index.js';

export interface DownloadTrend {
    period: string;
    downloads: number;
    tracks: number;
    albums: number;
    size: number;
    change: number;
}

export interface QualityDistribution {
    quality: number;
    label: string;
    count: number;
    percentage: number;
    totalSize: number;
}

export interface GenreBreakdown {
    genre: string;
    count: number;
    percentage: number;
    totalSize: number;
}

export interface ArtistInsight {
    name: string;
    trackCount: number;
    albumCount: number;
    totalSize: number;
    averageQuality: number;
    imageUrl?: string;
    firstDownload: string;
    lastDownload: string;
}

export interface TimeDistribution {
    hour: number;
    downloads: number;
    label: string;
}

export interface StorageAnalytics {
    totalSize: number;
    formattedSize: string;
    byFormat: {
        format: string;
        size: number;
        count: number;
        percentage: number;
    }[];
    byQuality: {
        quality: number;
        size: number;
        percentage: number;
    }[];
    estimatedGrowth: number;
}

export interface AnalyticsDashboard {
    summary: {
        totalTracks: number;
        totalDuration: string;
        totalArtists: number;
        totalSize: string;
        avgQuality: number;
        downloadsToday: number;
        downloadsThisWeek: number;
        downloadsThisMonth: number;
    };
    trends: {
        daily: DownloadTrend[];
        weekly: DownloadTrend[];
        monthly: DownloadTrend[];
    };
    qualityDistribution: QualityDistribution[];
    genreBreakdown: GenreBreakdown[];
    topArtists: ArtistInsight[];
    storage: StorageAnalytics;
    insights: string[];
}

const QUALITY_LABELS: Record<number, string> = {
    5: 'MP3 320kbps',
    6: 'FLAC 16-bit/44.1kHz',
    7: 'FLAC 24-bit/96kHz',
    27: 'FLAC 24-bit/192kHz'
};

class AdvancedAnalyticsService {
    getDashboard(): AnalyticsDashboard {
        const overall = databaseService.getOverallStats();
        const dailyStats = databaseService.getDailyStats(30);
        const genreStats = databaseService.getGenreStats(5);
        const qualityStats = databaseService.getQualityStats();
        const topArtists = databaseService.getTopArtists(5);

        const today = new Date().toISOString().split('T')[0];
        const todayStats = dailyStats.find((s) => s.date === today);
        const weekStats = this.aggregateStats(dailyStats.slice(0, 7));
        const monthStats = this.aggregateStats(dailyStats);

        return {
            summary: {
                totalTracks: overall.totalTracks,
                totalDuration: this.formatDuration(overall.totalDuration || 0),
                totalArtists: overall.uniqueArtists,
                totalSize: this.formatBytes(overall.totalSize),
                avgQuality: overall.avgQuality,
                downloadsToday: todayStats?.downloads || 0,
                downloadsThisWeek: weekStats.downloads,
                downloadsThisMonth: monthStats.downloads
            },
            trends: {
                daily: this.calculateDailyTrends(dailyStats),
                weekly: this.calculateWeeklyTrends(dailyStats),
                monthly: this.calculateMonthlyTrends()
            },
            qualityDistribution: this.getQualityDistribution(qualityStats, overall.totalTracks),
            genreBreakdown: this.getGenreBreakdown(genreStats, overall.totalTracks),
            topArtists: this.getTopArtistInsights(topArtists),
            storage: this.getStorageAnalytics(overall.totalSize, qualityStats),
            insights: this.generateInsights(overall, dailyStats, qualityStats, genreStats)
        };
    }

    private formatDuration(seconds: number): string {
        if (!seconds) return '0h 0m';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }

    private calculateDailyTrends(dailyStats: any[]): DownloadTrend[] {
        return dailyStats.map((stat, index) => {
            const previous = dailyStats[index + 1];
            const change = previous
                ? ((stat.downloads - previous.downloads) / Math.max(previous.downloads, 1)) * 100
                : 0;

            return {
                period: stat.date,
                downloads: stat.downloads,
                tracks: stat.tracks,
                albums: stat.albums,
                size: stat.total_size || 0,
                change: Math.round(change * 10) / 10
            };
        });
    }

    private calculateWeeklyTrends(dailyStats: any[]): DownloadTrend[] {
        const weeks: DownloadTrend[] = [];

        for (let i = 0; i < dailyStats.length; i += 7) {
            const weekData = dailyStats.slice(i, i + 7);
            const aggregated = this.aggregateStats(weekData);

            const previousWeek =
                i + 7 < dailyStats.length
                    ? this.aggregateStats(dailyStats.slice(i + 7, i + 14))
                    : null;

            const change = previousWeek
                ? ((aggregated.downloads - previousWeek.downloads) /
                      Math.max(previousWeek.downloads, 1)) *
                  100
                : 0;

            weeks.push({
                period: `Week of ${weekData[weekData.length - 1]?.date || 'Unknown'}`,
                downloads: aggregated.downloads,
                tracks: aggregated.tracks,
                albums: aggregated.albums,
                size: aggregated.size,
                change: Math.round(change * 10) / 10
            });
        }

        return weeks.slice(0, 4);
    }

    private calculateMonthlyTrends(): DownloadTrend[] {
        return [];
    }

    private getQualityDistribution(
        qualityStats: any[],
        totalTracks: number
    ): QualityDistribution[] {
        return qualityStats.map((stat) => ({
            quality: stat.quality,
            label: QUALITY_LABELS[stat.quality] || `Quality ${stat.quality}`,
            count: stat.count,
            percentage: totalTracks > 0 ? Math.round((stat.count / totalTracks) * 100) : 0,
            totalSize: stat.total_size || 0
        }));
    }

    private getGenreBreakdown(genreStats: any[], totalTracks: number): GenreBreakdown[] {
        return genreStats.slice(0, 15).map((stat) => ({
            genre: stat.genre,
            count: stat.count,
            percentage: totalTracks > 0 ? Math.round((stat.count / totalTracks) * 100) : 0,
            totalSize: stat.total_size || 0
        }));
    }

    private getTopArtistInsights(artists: any[]): ArtistInsight[] {
        return artists.map((artist) => ({
            name: artist.name,
            trackCount: artist.track_count || 0,
            albumCount: artist.album_count || 0,
            totalSize: artist.total_size || 0,
            averageQuality: artist.avg_quality || 0,
            imageUrl: artist.image_url || undefined,
            firstDownload: artist.first_download || '',
            lastDownload: artist.last_download || ''
        }));
    }

    private getStorageAnalytics(totalSize: number, qualityStats: any[]): StorageAnalytics {
        const byQuality = qualityStats.map((stat) => ({
            quality: stat.quality,
            size: stat.total_size || 0,
            percentage: totalSize > 0 ? Math.round(((stat.total_size || 0) / totalSize) * 100) : 0
        }));

        const mp3Stats = qualityStats.find((s) => s.quality === 5);
        const flacStats = qualityStats.filter((s) => s.quality !== 5);

        const mp3Size = mp3Stats?.total_size || 0;
        const mp3Count = mp3Stats?.count || 0;
        const flacSize = flacStats.reduce((sum, s) => sum + (s.total_size || 0), 0);
        const flacCount = flacStats.reduce((sum, s) => sum + (s.count || 0), 0);

        const byFormat = [];
        if (flacCount > 0 || flacSize > 0) {
            byFormat.push({
                format: 'FLAC',
                size: flacSize,
                count: flacCount,
                percentage: totalSize > 0 ? Math.round((flacSize / totalSize) * 100) : 0
            });
        }
        if (mp3Count > 0 || mp3Size > 0) {
            byFormat.push({
                format: 'MP3',
                size: mp3Size,
                count: mp3Count,
                percentage: totalSize > 0 ? Math.round((mp3Size / totalSize) * 100) : 0
            });
        }

        const dailyStats = databaseService.getDailyStats(30);
        const totalMonthSize = dailyStats.reduce((sum, s) => sum + (s.total_size || 0), 0);

        return {
            totalSize,
            formattedSize: this.formatBytes(totalSize),
            byFormat,
            byQuality,
            estimatedGrowth: totalMonthSize
        };
    }

    private generateInsights(
        overall: any,
        dailyStats: any[],
        qualityStats: any[],
        genreStats: any[]
    ): string[] {
        const insights: string[] = [];

        const hiResCount = qualityStats
            .filter((s) => s.quality >= 7)
            .reduce((sum, s) => sum + s.count, 0);
        const hiResPercentage =
            overall.totalTracks > 0 ? (hiResCount / overall.totalTracks) * 100 : 0;

        if (hiResPercentage > 80) {
            insights.push('🎵 Excellent! Over 80% of your library is Hi-Res audio.');
        } else if (hiResPercentage > 50) {
            insights.push(
                `🎵 ${Math.round(hiResPercentage)}% of your library is Hi-Res. Consider upgrading older tracks.`
            );
        }

        const recentDownloads = dailyStats.slice(0, 7).reduce((sum, s) => sum + s.downloads, 0);
        const previousWeekDownloads = dailyStats
            .slice(7, 14)
            .reduce((sum, s) => sum + s.downloads, 0);

        if (recentDownloads > previousWeekDownloads * 1.5) {
            insights.push('📈 Your download activity increased by 50%+ this week!');
        } else if (recentDownloads < previousWeekDownloads * 0.5 && previousWeekDownloads > 0) {
            insights.push('📉 Download activity decreased this week. New releases available?');
        }

        if (genreStats.length > 10) {
            insights.push(
                `🎨 Great diversity! You have music from ${genreStats.length} different genres.`
            );
        }

        if (overall.totalSize > 100 * 1024 * 1024 * 1024) {
            insights.push(
                `💾 Your library is ${this.formatBytes(overall.totalSize)}. Consider organizing by folders.`
            );
        }

        if (overall.uniqueArtists > 100) {
            insights.push(
                `🎤 You've downloaded music from ${overall.uniqueArtists} different artists!`
            );
        }

        return insights;
    }

    private aggregateStats(stats: any[]): {
        downloads: number;
        tracks: number;
        albums: number;
        size: number;
    } {
        return stats.reduce(
            (acc, stat) => ({
                downloads: acc.downloads + (stat.downloads || 0),
                tracks: acc.tracks + (stat.tracks || 0),
                albums: acc.albums + (stat.albums || 0),
                size: acc.size + (stat.total_size || 0)
            }),
            { downloads: 0, tracks: 0, albums: 0, size: 0 }
        );
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    comparePeriods(
        _start1: Date,
        _end1: Date,
        _start2: Date,
        _end2: Date
    ): {
        period1: { downloads: number; size: number };
        period2: { downloads: number; size: number };
        change: { downloads: number; size: number };
    } {
        return {
            period1: { downloads: 0, size: 0 },
            period2: { downloads: 0, size: 0 },
            change: { downloads: 0, size: 0 }
        };
    }

    getRecommendations(): {
        upgradeableTracsk: { id: string; title: string; currentQuality: number }[];
        missingFromAlbums: { albumId: string; albumTitle: string; missingCount: number }[];
        suggestedArtists: string[];
    } {
        return {
            upgradeableTracsk: [],
            missingFromAlbums: [],
            suggestedArtists: []
        };
    }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
export default advancedAnalyticsService;
