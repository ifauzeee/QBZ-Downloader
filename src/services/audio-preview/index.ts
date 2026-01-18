import { EventEmitter } from 'events';
import QobuzAPI from '../../api/qobuz.js';
import { logger } from '../../utils/logger.js';
import { cacheService } from '../../utils/cache.js';
import { CONFIG } from '../../config.js';

export interface PreviewInfo {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    streamUrl: string;
    quality: number;
    qualityLabel: string;
    coverUrl: string;
    waveform?: number[];
    expiresAt: number;
}

export interface PlaybackState {
    trackId: string | null;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    quality: number;
}

const QUALITY_LABELS: Record<number, string> = {
    5: 'MP3 320kbps',
    6: 'FLAC 16-bit/44.1kHz',
    7: 'FLAC 24-bit/96kHz',
    27: 'FLAC 24-bit/192kHz'
};

class AudioPreviewService extends EventEmitter {
    private api: QobuzAPI;
    private currentTrack: PreviewInfo | null = null;
    private previewCache: Map<string, PreviewInfo> = new Map();
    private cacheExpiry = 30 * 60 * 1000;

    constructor() {
        super();
        this.api = new QobuzAPI();
    }

    async getPreviewInfo(trackId: string): Promise<PreviewInfo | null> {
        const cached = this.previewCache.get(trackId);
        if (cached && cached.expiresAt > Date.now()) {
            return cached;
        }

        try {
            const trackResult = await this.api.getTrack(trackId);
            if (!trackResult.success || !trackResult.data) {
                return null;
            }

            const track = trackResult.data;

            const streamQuality = CONFIG.quality.streaming || 5;
            const urlResult = await this.api.getFileUrl(trackId, streamQuality);

            if (!urlResult.success || !urlResult.data) {
                return null;
            }

            const streamData = urlResult.data as any;
            const quality = streamData.format_id || streamQuality;

            const previewInfo: PreviewInfo = {
                trackId,
                title: track.title,
                artist: track.performer?.name || track.album?.artist?.name || 'Unknown',
                album: track.album?.title || 'Unknown',
                duration: track.duration || 0,
                streamUrl: streamData.url,
                quality,
                qualityLabel: QUALITY_LABELS[quality] || `Quality ${quality}`,
                coverUrl: this.getCoverUrl(track.album?.image || {}),
                expiresAt: Date.now() + this.cacheExpiry
            };

            this.previewCache.set(trackId, previewInfo);
            await cacheService.set(`preview:${trackId}`, previewInfo, 1800);

            return previewInfo;
        } catch (error: any) {
            logger.error(`Failed to get preview info: ${error.message}`, 'PREVIEW');
            return null;
        }
    }

    async getStreamUrl(trackId: string, quality?: number): Promise<string | null> {
        try {
            const preferredQuality = quality || CONFIG.quality.streaming || 5;
            const result = await this.api.getFileUrl(trackId, preferredQuality);

            if (result.success && result.data) {
                const data = result.data as any;

                let meta = this.previewCache.get(trackId);

                if (!meta) {
                    try {
                        const trackRes = await this.api.getTrack(trackId);
                        if (trackRes.success && trackRes.data) {
                            const track = trackRes.data;
                            meta = {
                                trackId,
                                title: track.title,
                                artist:
                                    track.performer?.name || track.album?.artist?.name || 'Unknown',
                                album: track.album?.title || 'Unknown',
                                duration: track.duration || 0,
                                streamUrl: data.url,
                                quality: data.format_id || preferredQuality,
                                qualityLabel:
                                    QUALITY_LABELS[data.format_id || preferredQuality] ||
                                    `Quality ${data.format_id}`,
                                coverUrl: this.getCoverUrl(track.album?.image || {}),
                                expiresAt: Date.now() + this.cacheExpiry
                            };
                            this.previewCache.set(trackId, meta);
                        }
                    } catch {}
                }

                if (meta) {
                    logger.debug(
                        `Stream URL obtained: ${meta.title} - ${meta.artist} @ ${data.format_id}`,
                        'PREVIEW'
                    );
                } else {
                    logger.debug(`Stream URL obtained: ${trackId} @ ${data.format_id}`, 'PREVIEW');
                }

                return data.url;
            }

            return null;
        } catch (error: any) {
            logger.error(`Failed to get stream URL: ${error.message}`, 'PREVIEW');
            return null;
        }
    }

    async getBatchPreviewInfo(trackIds: string[]): Promise<Map<string, PreviewInfo>> {
        const results = new Map<string, PreviewInfo>();

        const batchSize = 5;
        for (let i = 0; i < trackIds.length; i += batchSize) {
            const batch = trackIds.slice(i, i + batchSize);
            const promises = batch.map((id) => this.getPreviewInfo(id));
            const infos = await Promise.all(promises);

            for (let j = 0; j < batch.length; j++) {
                if (infos[j]) {
                    results.set(batch[j], infos[j]!);
                }
            }
        }

        return results;
    }

    generateWaveform(duration: number, samples = 100): number[] {
        const waveform: number[] = [];
        const seed = duration;

        for (let i = 0; i < samples; i++) {
            const t = i / samples;
            const noise = (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1;
            const envelope = Math.sin(t * Math.PI) * 0.5 + 0.5;
            const variation = Math.sin(t * 6.28 * 3) * 0.2;

            const value = Math.max(0.1, Math.min(1, (noise * 0.4 + 0.3) * envelope + variation));
            waveform.push(value);
        }

        return waveform;
    }

    getRecentPreviews(limit = 10): PreviewInfo[] {
        const previews = Array.from(this.previewCache.values())
            .filter((p) => p.expiresAt > Date.now())
            .slice(0, limit);
        return previews;
    }

    clearCache(): void {
        this.previewCache.clear();
        this.currentTrack = null;
    }

    private getCoverUrl(image: any): string {
        if (typeof image === 'string') return image;

        const sizes = ['mega', 'extralarge', 'large', 'medium', 'small', 'thumbnail'];
        for (const size of sizes) {
            if (image[size]) return image[size];
        }

        return '';
    }

    async prefetch(trackIds: string[]): Promise<void> {
        const uncached = trackIds.filter((id) => !this.previewCache.has(id));

        if (uncached.length === 0) return;

        logger.debug(`Prefetching ${uncached.length} tracks`, 'PREVIEW');

        for (const trackId of uncached.slice(0, 5)) {
            this.getPreviewInfo(trackId).catch(() => {});
        }
    }

    getStats(): {
        cachedPreviews: number;
        currentTrack: string | null;
    } {
        return {
            cachedPreviews: this.previewCache.size,
            currentTrack: this.currentTrack?.trackId || null
        };
    }
}

export const audioPreviewService = new AudioPreviewService();
export default audioPreviewService;
