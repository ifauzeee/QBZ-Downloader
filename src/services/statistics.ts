import fs from 'fs';
import { historyService } from './history.js';
import { downloadQueue } from './queue/queue.js';
import { logger } from '../utils/logger.js';

interface DailyStats {
    date: string;
    downloads: number;
    totalSize: number;
    tracks: number;
    albums: number;
    playlists: number;
}

interface QualityStats {
    quality: number;
    label: string;
    count: number;
    percentage: number;
}

interface ArtistStats {
    name: string;
    count: number;
    imageUrl?: string;
}

interface OverallStats {
    totalDownloads: number;
    totalSize: number;
    totalTracks: number;
    totalAlbums: number;
    totalPlaylists: number;
    averagePerDay: number;
    firstDownload: string | null;
    lastDownload: string | null;
}

export interface StatisticsData {
    overall: OverallStats;
    daily: DailyStats[];
    byQuality: QualityStats[];
    topArtists: ArtistStats[];
    queueStats: {
        pending: number;
        downloading: number;
        completed: number;
        failed: number;
        total: number;
    };
}

const QUALITY_LABELS: Record<number, string> = {
    5: 'MP3 320kbps',
    6: 'FLAC 16-bit/44.1kHz',
    7: 'FLAC 24-bit/96kHz',
    27: 'FLAC 24-bit/192kHz'
};

class StatisticsService {
    getAll(): StatisticsData {
        return {
            overall: this.getOverallStats(),
            daily: this.getDailyStats(),
            byQuality: this.getQualityStats(),
            topArtists: this.getTopArtists(),
            queueStats: downloadQueue.getStats()
        };
    }

    getOverallStats(): OverallStats {
        const history = historyService.getAll();
        const entries = Object.values(history);

        if (entries.length === 0) {
            return {
                totalDownloads: 0,
                totalSize: 0,
                totalTracks: 0,
                totalAlbums: 0,
                totalPlaylists: 0,
                averagePerDay: 0,
                firstDownload: null,
                lastDownload: null
            };
        }

        const dates = entries
            .map((e) => new Date(e.downloadedAt))
            .sort((a, b) => a.getTime() - b.getTime());
        const firstDate = dates[0];
        const lastDate = dates[dates.length - 1];
        const daysDiff = Math.max(
            1,
            Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        let totalSize = 0;
        let tracks = 0;
        let albums = 0;
        let playlists = 0;

        for (const entry of entries) {
            if (entry.filename && fs.existsSync(entry.filename)) {
                try {
                    const stats = fs.statSync(entry.filename);
                    totalSize += stats.size;
                } catch {}
            }

            switch (entry.type) {
                case 'track':
                    tracks++;
                    break;
                case 'album':
                    albums++;
                    break;
                case 'playlist':
                    playlists++;
                    break;
                default:
                    tracks++;
            }
        }

        return {
            totalDownloads: entries.length,
            totalSize,
            totalTracks: tracks,
            totalAlbums: albums,
            totalPlaylists: playlists,
            averagePerDay: Math.round((entries.length / daysDiff) * 10) / 10,
            firstDownload: firstDate.toISOString(),
            lastDownload: lastDate.toISOString()
        };
    }

    getDailyStats(days: number = 30): DailyStats[] {
        const history = historyService.getAll();
        const entries = Object.values(history);

        const dailyMap = new Map<string, DailyStats>();
        const now = new Date();

        for (let i = 0; i < days; i++) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            dailyMap.set(dateStr, {
                date: dateStr,
                downloads: 0,
                totalSize: 0,
                tracks: 0,
                albums: 0,
                playlists: 0
            });
        }

        for (const entry of entries) {
            const dateStr = entry.downloadedAt.split('T')[0];
            const stats = dailyMap.get(dateStr);

            if (stats) {
                stats.downloads++;

                if (entry.filename && fs.existsSync(entry.filename)) {
                    try {
                        const fileStats = fs.statSync(entry.filename);
                        stats.totalSize += fileStats.size;
                    } catch {}
                }

                switch (entry.type) {
                    case 'track':
                        stats.tracks++;
                        break;
                    case 'album':
                        stats.albums++;
                        break;
                    case 'playlist':
                        stats.playlists++;
                        break;
                    default:
                        stats.tracks++;
                }
            }
        }

        return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    }

    getQualityStats(): QualityStats[] {
        const history = historyService.getAll();
        const entries = Object.values(history);

        const qualityMap = new Map<number, number>();
        const total = entries.length;

        for (const entry of entries) {
            const q = entry.quality || 27;
            qualityMap.set(q, (qualityMap.get(q) || 0) + 1);
        }

        const stats: QualityStats[] = [];
        for (const [quality, count] of qualityMap) {
            stats.push({
                quality,
                label: QUALITY_LABELS[quality] || `Quality ${quality}`,
                count,
                percentage: total > 0 ? Math.round((count / total) * 100) : 0
            });
        }

        return stats.sort((a, b) => b.quality - a.quality);
    }

    getTopArtists(limit: number = 10): ArtistStats[] {
        const history = historyService.getAll();
        const entries = Object.values(history);

        const rawCounts = new Map<string, { count: number; imageUrl?: string }>();
        const sortedEntries = entries.sort(
            (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
        );

        for (const entry of sortedEntries) {
            if (entry.title && entry.title.includes('Lonely')) {
                logger.info(
                    `[STATS DEBUG] Found Lonely: Artist="${entry.artist}", AlbumArtist="${entry.albumArtist}"`,
                    'STATS'
                );
            }

            let artistName = entry.albumArtist;

            const currentName = artistName || entry.artist || '';
            const separators = [
                ' featuring ',
                ' feat. ',
                ' feat ',
                ' & ',
                ' , ',
                ' x ',
                ' X ',
                ' / '
            ];

            if (entry.filename) {
                const parts = entry.filename.split(/[/\\]/);
                if (parts.length >= 3) {
                    const folderArtist = parts[parts.length - 3];
                    if (folderArtist && folderArtist.toLowerCase() !== 'downloads') {
                        if (currentName.toLowerCase().includes(folderArtist.toLowerCase())) {
                            artistName = folderArtist;
                            logger.debug(
                                `[Stats] Simplified artist from "${currentName}" to "${artistName}" (folder match)`,
                                'STATS'
                            );
                        } else if (!artistName) {
                            artistName = folderArtist;
                        }
                    }
                }
            }

            if (!artistName || separators.some((sep) => artistName && artistName.includes(sep))) {
                const nameToSplit = artistName || entry.artist;
                if (nameToSplit) {
                    for (const sep of separators) {
                        if (nameToSplit.includes(sep)) {
                            const candidate = nameToSplit.split(sep)[0].trim();
                            if (candidate.length > 2) {
                                if (!artistName || candidate.length < artistName.length) {
                                    artistName = candidate;
                                    logger.debug(
                                        `[Stats] Split artist "${nameToSplit}" to "${artistName}"`,
                                        'STATS'
                                    );
                                }
                            }
                            break;
                        }
                    }
                }
            }

            if (!artistName) artistName = entry.artist;

            if (!artistName) artistName = entry.artist;

            if (artistName) {
                const artist = artistName.trim();
                const existing = rawCounts.get(artist);

                if (existing) {
                    existing.count++;
                    if (!existing.imageUrl && entry.artistImageUrl) {
                        existing.imageUrl = entry.artistImageUrl;
                    }
                } else {
                    rawCounts.set(artist, {
                        count: 1,
                        imageUrl: entry.artistImageUrl
                    });
                }
            }
        }

        const artists = Array.from(rawCounts.keys());

        const mergedCounts = new Map<string, { count: number; imageUrl?: string }>();
        const processed = new Set<string>();

        artists.sort((a, b) => a.length - b.length);

        for (const artist of artists) {
            if (processed.has(artist)) continue;

            const data = rawCounts.get(artist)!;
            let totalCount = data.count;
            let imageUrl = data.imageUrl;

            for (const otherArtist of artists) {
                if (artist === otherArtist || processed.has(otherArtist)) continue;

                const escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const sep = '(?:^|\\s*(?:&|,|feat\\.?|ft\\.?|x|\\/)\\s*)';
                const endSep = '(?:$|\\s*(?:&|,|feat\\.?|ft\\.?|x|\\/)\\s*)';
                const pattern = new RegExp(`${sep}${escapedArtist}${endSep}`, 'i');

                const isVariation = pattern.test(otherArtist);

                if (isVariation) {
                    const otherData = rawCounts.get(otherArtist)!;
                    totalCount += otherData.count;
                    if (!imageUrl && otherData.imageUrl) imageUrl = otherData.imageUrl;

                    processed.add(otherArtist);
                }
            }

            mergedCounts.set(artist, { count: totalCount, imageUrl });
            processed.add(artist);
        }

        const stats: ArtistStats[] = [];
        for (const [name, data] of mergedCounts) {
            stats.push({ name, count: data.count, imageUrl: data.imageUrl });
        }

        return stats.sort((a, b) => b.count - a.count).slice(0, limit);
    }

    formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    getSummary(): {
        downloads: number;
        size: string;
        today: number;
        queued: number;
    } {
        const overall = this.getOverallStats();
        const daily = this.getDailyStats(1);
        const queueStats = downloadQueue.getStats();

        return {
            downloads: overall.totalDownloads,
            size: this.formatBytes(overall.totalSize),
            today: daily[0]?.downloads || 0,
            queued: queueStats.pending + queueStats.downloading
        };
    }
}

export const statisticsService = new StatisticsService();
