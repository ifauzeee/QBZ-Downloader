import path from 'path';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import pLimit from 'p-limit';

import { logger } from '../utils/logger.js';
import { retryOperation } from '../utils/async.js';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService, { Metadata } from './metadata.js';
import { Album, FileUrlData } from '../types/qobuz.js';
import { historyService } from './history.js';
import { resumeService } from './batch.js';

import { DownloadEngine, DownloadProgress } from './DownloadEngine.js';
import { MetadataProcessor } from './MetadataProcessor.js';
import { qualityScannerService, QualityReport } from './QualityScannerService.js';
import { mediaServerService } from './MediaServerService.js';
import { formatConverterService } from './FormatConverterService.js';
import { aiMetadataService } from './AIMetadataService.js';

export { DownloadProgress };

interface DownloadOptions {
    outputDir?: string;
    onProgress?: (progress: DownloadProgress) => void;
    isCancelled?: () => boolean;
    onMetadata?: (metadata: Metadata) => void;
    onQuality?: (quality: number) => void;
    trackIndices?: number[];
    skipExisting?: boolean;
    album?: any;
}

export interface BatchProgressCallback {
    (
        trackId: string,
        data: {
            filename?: string;
            status?: 'pending' | 'downloading' | 'processing' | 'done' | 'failed';
            phase?: string;
            loaded?: number;
            total?: number;
            speed?: number;
            error?: string;
        }
    ): void;
}

export interface AlbumDownloadOptions {
    trackIndices?: number[];
    onProgress?: BatchProgressCallback;
    onAlbumInfo?: (album: Album) => void;
    batch?: boolean;
    skipExisting?: boolean;
    onMetadata?: (metadata: { title?: string; artist?: string; album?: string }) => void;
    onQuality?: (quality: number) => void;
    isCancelled?: () => boolean;
}

interface DownloadResult {
    success: boolean;
    trackId?: string | number;
    quality?: number;
    filePath?: string;
    metadata?: Metadata;
    error?: string | null;
    tracks?: DownloadResult[];
    title?: string;
    artist?: string;
    completedTracks?: number;
    failedTracks?: number;
    totalTracks?: number;
    name?: string;
    lyrics?: any;
    skipped?: boolean;
}

export default class DownloadService {
    api: QobuzAPI;
    lyricsProvider: LyricsProvider;
    metadataService: MetadataService;
    engine: DownloadEngine;
    processor: MetadataProcessor;

    constructor(api: QobuzAPI, lyricsProvider: LyricsProvider, metadataService: MetadataService) {
        this.api = api;
        this.lyricsProvider = lyricsProvider;
        this.metadataService = metadataService;
        this.engine = new DownloadEngine();
        this.processor = new MetadataProcessor();
    }

    sanitizeFilename(name: string) {
        return this.processor.sanitizeFilename(name);
    }

    buildFolderPath(metadata: Metadata, quality: number) {
        return this.processor.buildFolderPath(metadata, quality);
    }

    buildFilename(metadata: Metadata, quality: number) {
        return this.processor.buildFilename(metadata, quality);
    }

    private getOutputDir(overrideDir?: string): string {
        const candidate = (overrideDir ?? CONFIG.download.outputDir ?? './downloads').trim();
        return path.resolve(candidate || './downloads');
    }

    async downloadTrack(
        trackId: string | number,
        quality = 27,
        options: DownloadOptions = {}
    ): Promise<DownloadResult> {
        let trackInfo;
        try {
            trackInfo = await retryOperation(
                async () => {
                    const res = await this.api.getTrack(trackId);
                    if (!res.success) throw new Error(res.error || 'Failed to fetch track info');
                    return res;
                },
                3,
                1000,
                'TRACK_INFO'
            );
        } catch (e: any) {
            return { success: false, error: e.message };
        }

        const track = trackInfo.data!;
        let album = options.album || track.album;

        if (!options.album && album && album.id) {
            try {
                const fullAlbumInfo = await retryOperation(
                    async () => {
                        const res = await this.api.getAlbum(album.id);
                        if (!res.success) throw new Error(res.error || 'Failed to fetch album info');
                        return res;
                    },
                    3,
                    1000,
                    'ALBUM_INFO'
                );
                if (fullAlbumInfo.success && fullAlbumInfo.data) {
                    album = fullAlbumInfo.data;
                }
            } catch (e: any) {
                logger.warn(`Failed to fetch full album info: ${e.message}`, 'DOWNLOAD');
            }
        }

        let fileUrl;
        try {
            fileUrl = await retryOperation(
                async () => {
                    const res = await this.api.getFileUrl(trackId, quality);
                    if (!res.success) throw new Error(res.error || 'Failed to get file URL');
                    return res;
                },
                3,
                1000,
                'FILE_URL'
            );
        } catch (e: any) {
            return { success: false, error: e.message };
        }

        const fileUrlData = fileUrl.data as FileUrlData;
        const actualQuality = fileUrlData.format_id || quality;
        if (options.onQuality) options.onQuality(actualQuality);

        let metadata = await this.metadataService.extractMetadata(track, album!, {});
        
        if (CONFIG.ai.enabled) {
            const repaired = await aiMetadataService.repairMetadata(metadata);
            if (repaired) {
                metadata = { ...metadata, ...repaired };
            }
        }

        if (options.onMetadata) options.onMetadata(metadata);

        const outputDir = this.getOutputDir(options.outputDir);
        const rawFolderPath = this.processor.buildFolderPath(metadata, actualQuality);
        const rawFilename = this.processor.buildFilename(metadata, actualQuality);

        const { folder: safeFolder, file: safeFile } = this.processor.ensurePathSafety(
            outputDir,
            rawFolderPath,
            rawFilename
        );

        const folderPath = path.join(outputDir, safeFolder);
        if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });

        const filename = safeFile;
        const filePath = path.join(folderPath, filename);

        if (options.skipExisting && existsSync(filePath)) {
            return { success: true, skipped: true, filePath, quality: actualQuality, metadata };
        }

        if (options.onProgress) options.onProgress({ phase: 'download_start', loaded: 0, total: 0 });

        try {
            
            const { size, md5 } = await this.engine.download(
                fileUrlData.url,
                filePath,
                trackId.toString(),
                metadata,
                0,
                actualQuality,
                options.onProgress,
                options.isCancelled
            );

            let lyricsResult = null;
            if (CONFIG.metadata.downloadLyrics) {
                if (options.onProgress) options.onProgress({ phase: 'lyrics', loaded: 0 });
                try {
                    const res = await this.lyricsProvider.getLyrics(
                        metadata.title,
                        metadata.artist,
                        metadata.album,
                        metadata.duration,
                        metadata.albumArtist
                    );
                    if (res.success) {
                        lyricsResult = res;
                        logger.success(`Lyrics found for: ${metadata.title} (Source: ${res.source})`, 'LYRICS');
                        if (CONFIG.metadata.saveLrcFile) {
                            const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
                            writeFileSync(lrcPath, res.syncedLyrics || res.plainLyrics || '', 'utf8');
                        }
                    } else {
                        logger.warn(`No lyrics found for: ${metadata.title}`, 'LYRICS');
                    }
                } catch (e: any) {
                    logger.error(`Lyrics error: ${e.message}`, 'LYRICS');
                }
            }

            let coverBuffer: Buffer | null = null;
            if (CONFIG.metadata.embedCover || CONFIG.metadata.saveCoverFile) {
                if (options.onProgress) options.onProgress({ phase: 'cover', loaded: 0 });
                try {
                    const coverUrl = metadata.coverUrl || album?.image?.mega || album?.image?.large;
                    if (coverUrl) {
                        const { default: axios } = await import('axios');
                        const coverResponse = await axios.get(coverUrl, { responseType: 'arraybuffer' });
                        coverBuffer = Buffer.from(coverResponse.data);
                        if (CONFIG.metadata.saveCoverFile) {
                            writeFileSync(path.join(folderPath, 'cover.jpg'), coverBuffer);
                        }
                    }
                } catch (e: any) {
                    logger.warn(`Cover error: ${e.message}`, 'COVER');
                }
            }

            if (options.onProgress) options.onProgress({ phase: 'tagging', loaded: 100 });
            await this.metadataService.writeMetadata(
                filePath,
                metadata,
                actualQuality,
                CONFIG.metadata.embedLyrics ? lyricsResult : null,
                coverBuffer
            );

            let scanResult: QualityReport | undefined;
            if (actualQuality >= 6) {
                if (options.onProgress) options.onProgress({ phase: 'verifying', loaded: 0 });
                try {
                    scanResult = await qualityScannerService.scanFile(filePath);
                    if (!scanResult.isTrueLossless) {
                        logger.warn(`Quality Warning for ${metadata.title}: ${scanResult.details}`, 'SCANNER');
                    }
                } catch (e: any) {
                    logger.error(`Quality scan failed: ${e.message}`, 'SCANNER');
                }
            }

            let finalFilePath = filePath;
            if (CONFIG.export.enabled) {
                const exportedPath = await formatConverterService.convert(filePath);
                if (exportedPath && !CONFIG.export.keepOriginal) {
                    finalFilePath = exportedPath;
                }
            }

            resumeService.completeDownload(trackId.toString());

            this.updateDatabase(trackId, metadata, actualQuality, finalFilePath, size, md5, track, album, scanResult);

            mediaServerService.notifyNewContent({
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                type: 'track',
                filePath
            });

            return { success: true, filePath, quality: actualQuality, metadata, lyrics: lyricsResult };
        } catch (error: any) {
            if (existsSync(filePath)) unlinkSync(filePath);
            return { success: false, error: error.message };
        }
    }

    private async updateDatabase(trackId: any, metadata: any, quality: any, filePath: any, size: any, md5: any, _track: any, _album: any, scanResult?: QualityReport) {
        historyService.add(trackId, {
            filename: filePath,
            quality: quality,
            title: metadata.title,
            artist: metadata.artist,
            albumArtist: metadata.albumArtist || metadata.artist,
            album: metadata.album,
            qualityScan: scanResult ? {
                isTrueLossless: scanResult.isTrueLossless,
                confidence: scanResult.confidence,
                details: scanResult.details
            } : undefined
        });

        try {
            const { databaseService } = await import('./database/index.js');
            databaseService.addTrack({
                id: trackId.toString(),
                title: metadata.title,
                artist: metadata.artist,
                album_artist: metadata.albumArtist || metadata.artist,
                album: metadata.album,
                album_id: metadata.qobuzAlbumId,
                duration: metadata.duration,
                quality: quality,
                file_path: filePath,
                file_size: size,
                cover_url: metadata.coverUrl,
                genre: metadata.genre,
                year: metadata.year ? parseInt(metadata.year.toString()) : undefined,
                isrc: metadata.isrc,
                label: metadata.label,
                checksum: md5,
                verification_status: 'verified'
            });
        } catch (e: any) {
            logger.warn(`DB update failed: ${e.message}`, 'DB');
        }
    }

    async downloadAlbum(albumId: string | number, quality = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const albumInfo = await this.api.getAlbum(albumId);
        if (!albumInfo.success) return { success: false, error: albumInfo.error };
        const album = albumInfo.data;

        const tracks = album?.tracks?.items || [];
        const limit = pLimit(CONFIG.download.concurrent);

        const promises = tracks.map((track: any) => limit(() => this.downloadTrack(track.id, quality, {
            album,
            isCancelled: options.isCancelled,
            onProgress: (p) => {
                if (options.onProgress) options.onProgress(track.id.toString(), {
                    status: 'downloading',
                    phase: p.phase,
                    loaded: p.loaded,
                    total: p.total,
                    speed: p.speed
                });
            }
        })));

        const results = await Promise.all(promises);
        const completed = results.filter(r => r.success).length;

        if (completed > 0 && album) {
            mediaServerService.notifyNewContent({
                title: album.title,
                artist: album.artist?.name || 'Unknown Artist',
                album: album.title,
                type: 'album'
            });
        }

        return { success: completed > 0, completedTracks: completed, totalTracks: results.length };
    }

    async downloadPlaylist(playlistId: string | number, quality = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const playlistInfo = await this.api.getPlaylist(playlistId);
        if (!playlistInfo.success) return { success: false, error: playlistInfo.error };
        const playlist = playlistInfo.data!;

        const tracks = playlist.tracks.items;
        const limit = pLimit(CONFIG.download.concurrent);

        const promises = tracks.map((track: any) => limit(() => this.downloadTrack(track.id, quality, {
            isCancelled: options.isCancelled,
            onProgress: (p) => {
                if (options.onProgress) options.onProgress(track.id.toString(), {
                    status: 'downloading',
                    phase: p.phase,
                    loaded: p.loaded,
                    total: p.total,
                    speed: p.speed
                });
            }
        })));

        const results = await Promise.all(promises);
        const completed = results.filter(r => r.success).length;

        if (completed > 0) {
            mediaServerService.notifyNewContent({
                title: playlist.name,
                artist: playlist.owner?.name || 'Unknown Owner',
                album: playlist.name,
                type: 'playlist'
            });
        }

        return { success: completed > 0, completedTracks: completed, totalTracks: results.length };
    }

    async downloadArtist(artistId: string | number, quality = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const artistInfo = await this.api.getArtist(artistId);
        if (!artistInfo.success) return { success: false, error: artistInfo.error };
        
        const albumsRes = await this.api.getArtistAlbums(artistId, 50);
        if (!albumsRes.success) return { success: false, error: albumsRes.error };

        const albums = (albumsRes.data as any)?.items || [];
        const limit = pLimit(CONFIG.download.concurrent);
        
        const results = [];
        for (const album of albums) {
            const res = await limit(() => this.downloadAlbum(album.id, quality, options));
            results.push(res);
        }

        const completed = results.filter(r => r.success).length;
        return { success: completed > 0, completedTracks: completed, totalTracks: results.length };
    }
}
