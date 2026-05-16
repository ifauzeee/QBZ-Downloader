import { EventEmitter } from 'events';
import qobuzApi from '../../api/qobuz.js';
import { logger } from '../../utils/logger.js';
import { cacheService } from '../../utils/cache.js';
import { CONFIG, normalizeDownloadQuality } from '../../config.js';
import { LRUCache } from 'lru-cache';

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
    isSample: boolean;
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
    private api = qobuzApi;
    private currentTrack: PreviewInfo | null = null;
    private previewCache = new LRUCache<string, PreviewInfo>({
        max: 200,
        ttl: 30 * 60 * 1000,
        updateAgeOnGet: true
    });

    constructor() {
        super();
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

            const streamQuality = normalizeDownloadQuality(CONFIG.quality.streaming, 5);
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
                waveform: this.generateWaveform(track.duration || 180),
                isSample: !!(streamData.sample || (streamData.duration && streamData.duration <= 30)),
                expiresAt: Date.now() + 30 * 60 * 1000
            };

            this.previewCache.set(trackId, previewInfo);
            await cacheService.set(`preview:${trackId}`, previewInfo, 1800);

            return previewInfo;
        } catch (error: any) {
            logger.error(`Failed to get preview info: ${error.message}`, 'PREVIEW');
            return null;
        }
    }

    async getStreamUrl(trackId: string, quality?: number | string): Promise<string | null> {
        try {
            const preferredQuality = normalizeDownloadQuality(
                quality,
                CONFIG.quality.streaming || 5
            );
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
                                isSample: !!(data.sample || (data.duration && data.duration <= 30)),
                                expiresAt: Date.now() + 30 * 60 * 1000
                            };
                            this.previewCache.set(trackId, meta as PreviewInfo);
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

}

export const audioPreviewService = new AudioPreviewService();
export default audioPreviewService;
