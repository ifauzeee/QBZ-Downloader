import path from 'path';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';

import { logger } from '../utils/logger.js';
import { retryOperation } from '../utils/async.js';
import { CONFIG, normalizeDownloadQuality } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService, { Metadata } from './metadata.js';
import { Album, FileUrlData, Track, LyricsResult } from '../types/qobuz.js';
import { historyService } from './history.js';
import { resumeService } from './batch.js';

import { DownloadEngine, DownloadProgress } from './DownloadEngine.js';
import { MetadataProcessor } from './MetadataProcessor.js';
import { qualityScannerService, QualityReport } from './QualityScannerService.js';
import { mediaServerService } from './MediaServerService.js';
import { formatConverterService } from './FormatConverterService.js';
import { aiMetadataService } from './AIMetadataService.js';
import { globalApiLimit } from '../utils/limit.js';

export { DownloadProgress };

interface DownloadOptions {
    outputDir?: string;
    onProgress?: (progress: DownloadProgress) => void;
    isCancelled?: () => boolean;
    onMetadata?: (metadata: Metadata) => void;
    onQuality?: (quality: number) => void;
    trackIndices?: number[];
    skipExisting?: boolean;
    album?: Album;
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
    lyrics?: LyricsResult | null;
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

    private async fetchCoverBuffer(
        metadata: Metadata,
        album: Album
    ): Promise<{ buffer: Buffer; url: string } | null> {
        const { default: axios } = await import('axios');
        const candidates = this.metadataService.getCoverUrlCandidates(
            (album?.image || {}) as Record<string, unknown>,
            CONFIG.metadata.coverSize,
            metadata.coverUrl
        );

        for (const url of candidates) {
            try {
                const response = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                });
                const contentType = String(response.headers?.['content-type'] || '');
                const buffer = Buffer.from(response.data);

                if (buffer.length > 0 && (!contentType || contentType.startsWith('image/'))) {
                    return { buffer, url };
                }
            } catch (e: unknown) {
                logger.debug(`Cover candidate failed (${url}): ${(e as Error).message}`, 'COVER');
            }
        }

        return null;
    }

    private buildQobuzLyrics(track: Track): LyricsResult | null {
        const qobuzLyrics = track?.lyrics;
        if (!qobuzLyrics) return null;

        const syncedLyrics =
            typeof qobuzLyrics.sync === 'string' && qobuzLyrics.sync.trim()
                ? qobuzLyrics.sync
                : null;
        const plainLyrics =
            typeof qobuzLyrics.text === 'string' && qobuzLyrics.text.trim()
                ? qobuzLyrics.text
                : null;

        if (!syncedLyrics && !plainLyrics) return null;

        return {
            success: true,
            syncedLyrics: !!syncedLyrics,
            synced: syncedLyrics,
            plainLyrics: plainLyrics || undefined,
            unsynced: plainLyrics,
            parsedLyrics: syncedLyrics ? this.lyricsProvider.parseLrc(syncedLyrics) : undefined,
            syltFormat: syncedLyrics ? this.lyricsProvider.toSylt(syncedLyrics) : undefined
        };
    }

    async downloadTrack(
        trackId: string | number,
        quality: number | string = 27,
        options: DownloadOptions = {}
    ): Promise<DownloadResult> {
        const requestedQuality = normalizeDownloadQuality(quality, CONFIG.quality.default);
        logger.debug(`Download track ${trackId} (Quality: ${requestedQuality}, Lyrics: ${CONFIG.metadata.downloadLyrics}, Embed: ${CONFIG.metadata.embedLyrics})`, 'DOWNLOAD');
        
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
        } catch (e: unknown) {
            return { success: false, error: (e as Error).message };
        }

        const track = trackInfo.data!;
        let album = options.album || track.album;
        const currentAlbum = album;

        if (!options.album && currentAlbum && currentAlbum.id) {
            try {
                const fullAlbumInfo = await retryOperation(
                    async () => {
                        const res = await this.api.getAlbum(currentAlbum.id!);
                        if (!res.success) throw new Error(res.error || 'Failed to fetch album info');
                        return res;
                    },
                    3,
                    1000,
                    'ALBUM_INFO'
                );
                if (fullAlbumInfo.success && fullAlbumInfo.data) {
                    album = fullAlbumInfo.data as Album;
                }
            } catch (e: unknown) {
                logger.warn(`Failed to fetch full album info: ${(e as Error).message}`, 'DOWNLOAD');
            }
        }

        let fileUrl;
        try {
            fileUrl = await retryOperation(
                async () => {
                    const res = await this.api.getFileUrl(trackId, requestedQuality);
                    if (!res.success) throw new Error(res.error || 'Failed to get file URL');
                    return res;
                },
                3,
                1000,
                'FILE_URL'
            );
        } catch (e: unknown) {
            return { success: false, error: (e as Error).message };
        }

        const fileUrlData = fileUrl.data as FileUrlData;
        const actualQuality = fileUrlData.format_id || requestedQuality;
        if (options.onQuality) options.onQuality(actualQuality);

        let metadata = await this.metadataService.extractMetadata(track, (album || {}) as Album, {});
        
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
        logger.info(`Saving download to: ${filePath}`, 'DOWNLOAD');

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
                logger.debug(`Starting lyrics acquisition for: ${metadata.title}`, 'LYRICS');
                if (options.onProgress) options.onProgress({ phase: 'lyrics', loaded: 0 });
                try {
                    const qobuzLyrics = this.buildQobuzLyrics(track);
                    if (qobuzLyrics) {
                        logger.success(`Lyrics found in Qobuz metadata: ${metadata.title}`, 'LYRICS');
                        lyricsResult = qobuzLyrics;
                    } else {
                        logger.debug(`Searching external providers for: ${metadata.title}`, 'LYRICS');
                        const res = await this.lyricsProvider.getLyrics(
                            metadata.title,
                            metadata.artist,
                            metadata.album,
                            metadata.duration,
                            metadata.albumArtist
                        );
                        if (res.success) {
                            lyricsResult = res;
                            logger.success(`Lyrics found via ${res.source}: ${metadata.title}`, 'LYRICS');
                            logger.debug(`Lyrics content: ${res.plainLyrics ? 'Plain(Yes)' : 'Plain(No)'}, ${res.syncedLyrics ? 'Synced(Yes)' : 'Synced(No)'}`, 'LYRICS');
                        } else {
                            logger.warn(`No lyrics found for: ${metadata.title}`, 'LYRICS');
                        }
                    }

                    if (lyricsResult && CONFIG.metadata.saveLrcFile) {
                        const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
                        writeFileSync(lrcPath, (lyricsResult.synced || lyricsResult.plainLyrics || '') as string, 'utf8');
                    }
                } catch (e: unknown) {
                    logger.error(`Lyrics acquisition error: ${(e as Error).message}`, 'LYRICS');
                }
            }

            let coverBuffer: Buffer | null = null;
            if (album && (CONFIG.metadata.embedCover || CONFIG.metadata.saveCoverFile)) {
                if (options.onProgress) options.onProgress({ phase: 'cover', loaded: 0 });
                try {
                    const cover = await this.fetchCoverBuffer(metadata, album as Album);
                    if (cover) {
                        coverBuffer = cover.buffer;
                        metadata.coverUrl = cover.url;
                        if (CONFIG.metadata.saveCoverFile) {
                            writeFileSync(path.join(folderPath, 'cover.jpg'), coverBuffer);
                        }
                    }
                } catch (e: unknown) {
                    logger.warn(`Cover error: ${(e as Error).message}`, 'COVER');
                }
            }

            if (options.onProgress) options.onProgress({ phase: 'tagging', loaded: 100 });
            await this.metadataService.writeMetadata(
                filePath,
                metadata,
                actualQuality,
                CONFIG.metadata.embedLyrics ? (lyricsResult as LyricsResult) : null,
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
                } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : String(e);
                    logger.error(`Quality scan failed: ${message}`, 'SCANNER');
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

            this.updateDatabase(trackId, metadata, actualQuality, finalFilePath, size, md5, track, album as Album, scanResult);

            mediaServerService.notifyNewContent({
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                type: 'track',
                filePath
            });

            return { success: true, filePath, quality: actualQuality, metadata, lyrics: lyricsResult as LyricsResult };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            if (existsSync(filePath)) unlinkSync(filePath);
            return { success: false, error: message };
        }
    }

    private async updateDatabase(
        trackId: string | number,
        metadata: Metadata,
        quality: number,
        filePath: string,
        size: number,
        md5: string,
        _track: Track,
        _album: Album,
        scanResult?: QualityReport
    ) {
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
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.warn(`DB update failed: ${message}`, 'DB');
        }
    }

    private concurrencyLimit = globalApiLimit;

    private writeErrorLog(folderPath: string, failedItems: { res: DownloadResult; track: Track }[]) {
        try {
            if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });
            const logPath = path.join(folderPath, 'missing_tracks.txt');
            const timestamp = new Date().toLocaleString();
            let content = 'QBZ-Downloader - Missing Tracks Log\n';
            content += `Generated: ${timestamp}\n`;
            content += `${'='.repeat(50)}\n\n`;

            failedItems.forEach((item, index) => {
                const track = item.track;
                const title = track?.title || 'Unknown Title';
                const artist = track?.performer?.name || track?.artist?.name || 'Unknown Artist';
                const error = item.res.error || 'Unknown Error';
                content += `${index + 1}. ${artist} - ${title}\n`;
                content += `   Track ID: ${track?.id}\n`;
                content += `   Error: ${error}\n\n`;
            });

            writeFileSync(logPath, content, 'utf8');
            logger.warn(`Created missing tracks log at: ${logPath}`, 'DOWNLOAD');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            logger.error(`Failed to write missing tracks log: ${message}`, 'DOWNLOAD');
        }
    }

    async downloadAlbum(albumId: string | number, quality: number | string = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const requestedQuality = normalizeDownloadQuality(quality, CONFIG.quality.default);
        const albumInfo = await this.api.getAlbum(albumId);
        if (!albumInfo.success) return { success: false, error: albumInfo.error };
        const album = albumInfo.data;

        if (options.onMetadata && album) {
            options.onMetadata({
                title: album.title,
                artist: album.artist?.name || 'Unknown Artist',
                album: album.title
            });
        }
 
        const tracks = album?.tracks?.items || [];
 
        const promises = tracks.map((track: Track) => this.concurrencyLimit(() => this.downloadTrack(track.id, requestedQuality, {
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
        const completed = results.filter((r) => r.success).length;

        const failedItems = results
            .map((res, index) => ({ res, track: tracks[index] }))
            .filter((item) => !item.res.success);

        if (failedItems.length > 0) {
            let albumFolderPath = '';
            const firstSuccess = results.find((r) => r.success && r.filePath);
            if (firstSuccess && firstSuccess.filePath) {
                albumFolderPath = path.dirname(firstSuccess.filePath);
            } else {
                try {
                    const tempMetadata = await this.metadataService.extractMetadata(tracks[0] as Track, album! as Album, {});
                    const outputDir = this.getOutputDir();
                    const rawFolderPath = this.processor.buildFolderPath(tempMetadata, requestedQuality);
                    const { folder: safeFolder } = this.processor.ensurePathSafety(
                        outputDir,
                        rawFolderPath,
                        'dummy.txt'
                    );
                    albumFolderPath = path.join(outputDir, safeFolder);
                } catch {
                    logger.error('Could not determine album folder for error logging', 'DOWNLOAD');
                }
            }

            if (albumFolderPath) {
                this.writeErrorLog(albumFolderPath, failedItems);
            }
        }

        if (completed > 0 && album) {
            mediaServerService.notifyNewContent({
                title: album.title,
                artist: album.artist?.name || 'Unknown Artist',
                album: album.title,
                type: 'album'
            });
        }

        return {
            success: completed > 0,
            completedTracks: completed,
            totalTracks: results.length,
            failedTracks: failedItems.length
        };
    }
 
    async downloadPlaylist(playlistId: string | number, quality: number | string = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const requestedQuality = normalizeDownloadQuality(quality, CONFIG.quality.default);
        const playlistInfo = await this.api.getPlaylist(playlistId);
        if (!playlistInfo.success) return { success: false, error: playlistInfo.error };
        const playlist = playlistInfo.data!;

        if (options.onMetadata) {
            options.onMetadata({
                title: playlist.name,
                artist: playlist.owner?.name || 'Various Artists',
                album: playlist.name
            });
        }
 
        const tracks = playlist.tracks.items;
 
        const promises = tracks.map((track: Track) => this.concurrencyLimit(() => this.downloadTrack(track.id, requestedQuality, {
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
        const completed = results.filter((r) => r.success).length;

        const failedItems = results
            .map((res, index) => ({ res, track: tracks[index] }))
            .filter((item) => !item.res.success);

        if (failedItems.length > 0) {
            const foldersMap = new Map<string, { res: DownloadResult; track: Track }[]>();
            for (const item of failedItems) {
                let folder = '';
                try {
                    const tempMetadata = await this.metadataService.extractMetadata(
                        item.track as Track,
                        (item.track.album || {}) as Album,
                        {}
                    );
                    const outputDir = this.getOutputDir();
                    const rawFolderPath = this.processor.buildFolderPath(tempMetadata, requestedQuality);
                    const { folder: safeFolder } = this.processor.ensurePathSafety(
                        outputDir,
                        rawFolderPath,
                        'dummy.txt'
                    );
                    folder = path.join(outputDir, safeFolder);
                } catch {
                    logger.debug(`Could not determine folder for playlist failure: ${item.track.id}`);
                }

                if (folder) {
                    if (!foldersMap.has(folder)) foldersMap.set(folder, []);
                    foldersMap.get(folder)!.push(item);
                }
            }

            for (const [folder, items] of foldersMap.entries()) {
                this.writeErrorLog(folder, items);
            }
        }

        if (completed > 0) {
            mediaServerService.notifyNewContent({
                title: playlist.name,
                artist: playlist.owner?.name || 'Unknown Owner',
                album: playlist.name,
                type: 'playlist'
            });
        }

        return {
            success: completed > 0,
            completedTracks: completed,
            totalTracks: results.length,
            failedTracks: failedItems.length
        };
    }
 
    async downloadArtist(artistId: string | number, quality: number | string = 27, options: AlbumDownloadOptions = {}): Promise<DownloadResult> {
        const requestedQuality = normalizeDownloadQuality(quality, CONFIG.quality.default);
        const artistInfo = await this.api.getArtist(artistId);
        if (!artistInfo.success) return { success: false, error: artistInfo.error };
        const artist = artistInfo.data!;

        if (options.onMetadata) {
            options.onMetadata({
                title: artist.name,
                artist: artist.name,
                album: 'Discography'
            });
        }
        
        const albumsRes = await this.api.getArtistAlbums(artistId, 50);
        if (!albumsRes.success) return { success: false, error: albumsRes.error };
 
        const albums = (albumsRes.data as { items?: Album[] })?.items || [];
        
        const results = [];
        for (const album of albums) {
            const res = await this.concurrencyLimit(() => this.downloadAlbum(album.id, requestedQuality, options));
            results.push(res);
        }
 
        const completed = results.filter((r) => r.success).length;
        const totalCompleted = results.reduce((acc, r) => acc + (r.completedTracks || 0), 0);
        const totalFailed = results.reduce((acc, r) => acc + (r.failedTracks || 0), 0);
        const totalTracks = results.reduce((acc, r) => acc + (r.totalTracks || 0), 0);

        return {
            success: completed > 0,
            completedTracks: totalCompleted,
            totalTracks: totalTracks,
            failedTracks: totalFailed
        };
    }
}
