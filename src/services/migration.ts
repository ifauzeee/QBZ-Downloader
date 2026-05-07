import { spotifyApi, SpotifyTrack } from '../api/spotify.js';
import QobuzAPI from '../api/qobuz.js';
import { logger } from '../utils/logger.js';
import { downloadQueue } from './queue/queue.js';

export interface MigrationResult {
    spotifyTrack: SpotifyTrack;
    qobuzTrackId?: string;
    found: boolean;
    quality?: number;
    matchScore: number;
}

class MigrationService {
    private qobuzApi: QobuzAPI;

    constructor(qobuzApi: QobuzAPI) {
        this.qobuzApi = qobuzApi;
    }

    async migrateFromSpotify(url: string, _quality: number = 27): Promise<{
        total: number;
        found: number;
        results: MigrationResult[];
    }> {
        const extraction = spotifyApi.extractId(url);
        if (!extraction) {
            throw new Error('Invalid Spotify URL. Please provide a playlist or album URL.');
        }

        let spotifyTracks: SpotifyTrack[] = [];
        if (extraction.type === 'playlist') {
            spotifyTracks = await spotifyApi.getPlaylistTracks(extraction.id);
        } else if (extraction.type === 'album') {
            spotifyTracks = await spotifyApi.getAlbumTracks(extraction.id);
        } else if (extraction.type === 'track') {
            const track = await spotifyApi.getTrack(extraction.id);
            if (track) spotifyTracks = [track];
        }

        logger.info(`Migration: Found ${spotifyTracks.length} tracks on Spotify. Searching on Qobuz...`, 'MIGRATION');

        const results: MigrationResult[] = [];
        for (const sTrack of spotifyTracks) {
            const match = await this.findOnQobuz(sTrack);
            results.push({
                spotifyTrack: sTrack,
                qobuzTrackId: match?.id,
                found: !!match,
                quality: match?.quality,
                matchScore: match?.score || 0
            });
        }

        const foundCount = results.filter(r => r.found).length;
        logger.info(`Migration complete: ${foundCount}/${results.length} tracks matched.`, 'MIGRATION');

        return {
            total: results.length,
            found: foundCount,
            results
        };
    }

    private async findOnQobuz(sTrack: SpotifyTrack): Promise<{ id: string; quality: number; score: number } | null> {
        if (sTrack.isrc) {
        }

        try {
            const query = `${sTrack.title} ${sTrack.artist.split(',')[0]}`;
            const searchRes = await this.qobuzApi.search(query, 'track', 5);

            if (searchRes.success && searchRes.data?.tracks?.items) {
                const candidates = searchRes.data.tracks.items;
                let bestMatch = null;
                let highestScore = 0;

                for (const qTrack of candidates) {
                    const score = this.calculateMatchScore(sTrack, qTrack);
                    if (score > highestScore && score > 0.7) {
                        highestScore = score;
                        bestMatch = qTrack;
                    }
                }

                if (bestMatch) {
                    return {
                        id: bestMatch.id.toString(),
                        quality: bestMatch.maximum_sampling_rate ? 27 : 6,
                        score: highestScore
                    };
                }
            }
        } catch (error: any) {
            logger.error(`Migration Search Error: ${error.message}`, 'MIGRATION');
        }

        return null;
    }

    private calculateMatchScore(sTrack: SpotifyTrack, qTrack: any): number {
        let score = 0;

        const sTitle = sTrack.title.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').trim();
        const qTitle = qTrack.title.toLowerCase().replace(/\(.*\)|\[.*\]/g, '').trim();

        if (sTitle === qTitle) score += 0.5;
        else if (qTitle.includes(sTitle) || sTitle.includes(qTitle)) score += 0.3;

        const sArtist = sTrack.artist.toLowerCase().split(',')[0].trim();
        const qArtist = qTrack.artist?.name?.toLowerCase() || '';

        if (qArtist.includes(sArtist) || sArtist.includes(qArtist)) score += 0.4;

        const sDuration = sTrack.duration_ms / 1000;
        const qDuration = qTrack.duration;
        if (Math.abs(sDuration - qDuration) < 5) score += 0.1;

        return score;
    }

    async startMigrationDownload(results: MigrationResult[], quality: number = 27): Promise<number> {
        let added = 0;
        for (const res of results) {
            if (res.found && res.qobuzTrackId) {
                downloadQueue.add('track', res.qobuzTrackId, quality, {
                    title: res.spotifyTrack.title,
                    metadata: { source: 'spotify-migration' }
                });
                added++;
            }
        }
        return added;
    }
}

export const createMigrationService = (qobuzApi: QobuzAPI) => new MigrationService(qobuzApi);
