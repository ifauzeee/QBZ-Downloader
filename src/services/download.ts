import path from 'path';
import axios from 'axios';
import { logger } from '../utils/logger.js';

import { pipeline } from 'stream/promises';
import {
    createWriteStream,
    mkdirSync,
    writeFileSync,
    unlinkSync,
    renameSync,
    createReadStream,
    existsSync
} from 'fs';
import { PassThrough } from 'stream';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService, { Metadata } from './metadata.js';
import { settingsService } from './settings.js';
import pLimit from 'p-limit';
import flac from 'flac-metadata';
import { Track, LyricsResult, Album } from '../types/qobuz.js';
import { historyService } from './history.js';

export interface DownloadProgress {
    phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging';
    loaded: number;
    total?: number;
    speed?: number;
}

interface DownloadOptions {
    outputDir?: string;
    onProgress?: (progress: DownloadProgress) => void;
    trackIndices?: number[];
    skipExisting?: boolean;
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
    lyrics?: LyricsResult | string;
    skipped?: boolean;
}

class DownloadService {
    api: QobuzAPI;
    lyricsProvider: LyricsProvider;
    metadataService: MetadataService;
    outputDir: string;

    constructor(api: QobuzAPI, lyricsProvider: LyricsProvider, metadataService: MetadataService) {
        this.api = api;
        this.lyricsProvider = lyricsProvider;
        this.metadataService = metadataService;
        this.outputDir = CONFIG.download.outputDir;
    }

    sanitizeFilename(name: string) {
        if (!name) return 'Unknown';
        return (
            name
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^\\.+|\\.+$/g, '')
                .substring(0, 200) || 'Unknown'
        );
    }

    buildFolderPath(metadata: Metadata, quality: number) {
        const template = CONFIG.download.folderStructure;
        const qualityName = CONFIG.quality.formats[quality]?.name || 'FLAC';

        return template
            .replace('{artist}', this.sanitizeFilename(metadata.albumArtist || metadata.artist))
            .replace('{album}', this.sanitizeFilename(metadata.album))
            .replace('{year}', metadata.year?.toString() || 'Unknown')
            .replace('{quality}', qualityName.replace('/', '-'))
            .replace(
                '{album_artist}',
                this.sanitizeFilename(metadata.albumArtist || metadata.artist)
            )
            .replace('{track_number}', metadata.trackNumber?.toString().padStart(2, '0') || '00');
    }

    buildFilename(metadata: Metadata, extension: string) {
        const template = CONFIG.download.fileNaming;
        const trackNum = metadata.trackNumber?.toString().padStart(2, '0') || '00';
        return (
            template
                .replace('{trackNumber}', trackNum)
                .replace('{track_number}', trackNum)
                .replace('{title}', this.sanitizeFilename(metadata.title))
                .replace('{artist}', this.sanitizeFilename(metadata.artist))
                .replace('{album}', this.sanitizeFilename(metadata.album))
                .replace('{year}', metadata.year?.toString() || 'Unknown') + `.${extension}`
        );
    }

    async getCoverBuffer(url: string) {
        if (!url) return null;
        try {
            const highResUrl = url.replace(/_\d+\.jpg/, '_max.jpg').replace('/600/', '/1200/');
            const response = await axios({
                method: 'GET',
                url: highResUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });
            return response.data;
        } catch {
            try {
                const response = await axios({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                return response.data;
            } catch {
                return null;
            }
        }
    }

    async downloadTrack(
        trackId: string | number,
        quality = 27,
        options: DownloadOptions = {}
    ): Promise<DownloadResult> {
        const result: DownloadResult = {
            success: false,
            trackId,
            quality,
            filePath: '',
            error: null
        };
        const embedLyrics = settingsService.get('embedLyrics') ?? CONFIG.metadata.embedLyrics;
        const embedCover = settingsService.get('embedCover') ?? CONFIG.metadata.embedCover;

        if (options.skipExisting && historyService.has(trackId)) {
            const entry = historyService.get(trackId);
            return {
                ...result,
                success: true,
                skipped: true,
                filePath: entry?.filename || 'Skipped (History)',
                name: entry?.title
            };
        }

        try {
            const trackInfo = await this.api.getTrack(trackId);
            if (!trackInfo.success) throw new Error(`Track Info Error: ${trackInfo.error}`);
            const track = trackInfo.data;
            logger.info(`Processing track: ${track?.title} - ${trackId}`);

            const fileUrl = await this.api.getFileUrl(trackId, quality);
            if (!fileUrl.success) throw new Error(`File URL Error: ${fileUrl.error}`);
            logger.debug(`File URL obtained for quality ${quality}`);

            const fileUrlData = fileUrl.data as any;
            const actualQuality = fileUrlData.format_id || quality;
            const extension = CONFIG.quality.formats[actualQuality]?.extension || 'flac';

            let albumData: Record<string, any> = track!.album || {};
            if (track!.album?.id) {
                const albumInfo = await this.api.getAlbum(track!.album!.id!);
                if (albumInfo.success && albumInfo.data)
                    albumData = albumInfo.data as unknown as Record<string, any>;
            }

            const fileUrlInfo = fileUrl.data as { bit_depth?: number; sampling_rate?: number };
            const metadata = await this.metadataService.extractMetadata(track!, albumData, {
                bitDepth: fileUrlInfo.bit_depth || 16,
                sampleRate: fileUrlInfo.sampling_rate || 44.1
            });
            logger.debug('Metadata extracted successfully');
            result.metadata = metadata;

            const rootDir = options.outputDir || this.outputDir;
            const folderPath = path.join(rootDir, this.buildFolderPath(metadata, actualQuality));
            mkdirSync(folderPath, { recursive: true });

            const filePath = path.join(folderPath, this.buildFilename(metadata, extension));
            result.filePath = filePath;

            let lyrics = null;
            if (embedLyrics) {
                if (options.onProgress) options.onProgress({ phase: 'lyrics', loaded: 0 });
                logger.debug(`Fetching lyrics for "${track!.title}"...`);
                const lyricsRes = await this.lyricsProvider.getLyrics(
                    track!.title,
                    metadata.artist,
                    metadata.album,
                    track!.duration,
                    metadata.albumArtist
                );
                if (lyricsRes.success) {
                    logger.success(`Lyrics found via ${lyricsRes.source}`);
                    lyrics = lyricsRes;
                } else {
                    logger.warn(`No lyrics found: ${lyricsRes.error}`);
                }
            }

            const maxAttempts = CONFIG.download.retryAttempts || 3;
            const retryDelay = CONFIG.download.retryDelay || 1000;
            let lastError = null;

            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    if (options.onProgress)
                        options.onProgress({ phase: 'download_start', loaded: 0 });

                    const fileStreamData = fileUrl.data as { url: string };
                    const response = await axios({
                        method: 'GET',
                        url: fileStreamData.url,
                        responseType: 'stream',
                        timeout: 0
                    });

                    const contentLength = response.headers['content-length'];
                    const totalSize = contentLength ? parseInt(contentLength, 10) : 0;
                    const writer = createWriteStream(filePath);
                    const progressStream = new PassThrough();

                    let downloaded = 0;
                    let lastTick = Date.now();
                    let lastLoaded = 0;

                    progressStream.on('data', (chunk: Buffer) => {
                        downloaded += chunk.length;
                        const now = Date.now();
                        if (now - lastTick > 500) {
                            const diff = now - lastTick;
                            const speed = ((downloaded - lastLoaded) / diff) * 1000;
                            if (options.onProgress)
                                options.onProgress({
                                    phase: 'download',
                                    loaded: downloaded,
                                    total: totalSize,
                                    speed
                                });
                            lastTick = now;
                            lastLoaded = downloaded;
                        }
                    });

                    await pipeline(response.data, progressStream, writer);

                    if (totalSize && downloaded < totalSize) {
                        throw new Error(
                            `Incomplete download: Expected ${totalSize} bytes, got ${downloaded}`
                        );
                    }

                    lastError = null;
                    break;
                } catch (error) {
                    lastError = error;
                    if (attempt < maxAttempts) {
                        const delay = retryDelay * attempt;
                        if (existsSync(filePath)) unlinkSync(filePath);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        continue;
                    }
                }
            }

            if (lastError) {
                throw lastError;
            }

            if (options.onProgress) options.onProgress({ phase: 'cover', loaded: 0 });
            const coverBuffer =
                embedCover || CONFIG.metadata.saveCoverFile
                    ? await this.getCoverBuffer(metadata.coverUrl)
                    : null;

            if (coverBuffer && CONFIG.metadata.saveCoverFile) {
                writeFileSync(path.join(folderPath, 'cover.jpg'), coverBuffer);
            }

            if (options.onProgress) options.onProgress({ phase: 'tagging', loaded: 0 });
            if (extension === 'mp3') {
                const tags = this.metadataService.buildId3Tags(
                    metadata,
                    embedCover ? coverBuffer : null,
                    lyrics
                );
                await this.metadataService.writeId3Tags(filePath, tags);
            } else if (extension === 'flac') {
                const tags = this.metadataService.buildFlacTags(metadata, lyrics);
                await this.embedFlacMetadata(filePath, tags, embedCover ? coverBuffer : null);
            }

            result.success = true;
            historyService.add(trackId, {
                filename: path.basename(filePath),
                quality,
                title: metadata.title
            });
            return result;
        } catch (error: unknown) {
            const err = error as any;
            result.error = err.message || 'Unknown error';
            if (err.code) result.error += ` (${err.code})`;
            return result;
        }
    }

    async embedFlacMetadata(filePath: string, tags: string[][], coverBuffer: Buffer | null) {
        try {
            const tempPath = filePath + '.tmp';
            const reader = createReadStream(filePath);
            const writer = createWriteStream(tempPath);
            const processor = new flac.Processor({ parseMetaDataBlocks: true });
            let tagsAdded = false;

            processor.on('preprocess', (mdb: any) => {
                if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) mdb.remove();
                if (coverBuffer && mdb.type === flac.Processor.MDB_TYPE_PICTURE) mdb.remove();
            });

            processor.on('postprocess', (mdb: any) => {
                if (mdb.type === flac.Processor.MDB_TYPE_STREAMINFO && !tagsAdded) {
                    tagsAdded = true;
                    const vorbisComment = flac.data.MetaDataBlockVorbisComment.create(
                        false,
                        '',
                        tags.map(([key, value]) => `${key}=${value}`)
                    );
                    processor.push(vorbisComment.publish());

                    if (coverBuffer) {
                        const picture = flac.data.MetaDataBlockPicture.create(
                            false,
                            3,
                            'image/jpeg',
                            'Cover',
                            0,
                            0,
                            0,
                            0,
                            coverBuffer
                        );
                        processor.push(picture.publish());
                    }
                }
            });

            reader.pipe(processor).pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
                reader.on('error', reject);
                processor.on('error', reject);
            });

            let retries = 3;
            while (retries > 0) {
                try {
                    if (existsSync(filePath)) unlinkSync(filePath);
                    renameSync(tempPath, filePath);
                    break;
                } catch (err) {
                    retries--;
                    if (retries === 0) throw err;
                    await new Promise((resolve) => setTimeout(resolve, 500));
                }
            }
        } catch (error: unknown) {
            throw new Error(`Tagging failed: ${(error as Error).message}`);
        }
    }

    async downloadAlbum(
        albumId: string | number,
        quality = 27,
        options: AlbumDownloadOptions = {}
    ): Promise<DownloadResult> {
        const albumInfo = await this.api.getAlbum(albumId);
        if (!albumInfo.success) return { success: false, error: albumInfo.error };
        const album = albumInfo.data;

        const tracksItems = album?.tracks?.items || [];
        let tracks: any[] = tracksItems;
        if (options.trackIndices)
            tracks = tracks.filter((_: unknown, i: number) => options.trackIndices!.includes(i));

        const limit = pLimit(CONFIG.download.concurrent);

        const promises = tracks.map((track) => {
            return limit(async () => {
                const trackId = track.id.toString();
                if (options.onProgress) {
                    options.onProgress(trackId, {
                        filename: `${track.track_number.toString().padStart(2, '0')}. ${track.title}`,
                        status: 'downloading',
                        phase: 'Initializing',
                        loaded: 0,
                        total: 0
                    });
                }

                const res = await this.downloadTrack(track.id, quality, {
                    skipExisting: options.skipExisting,
                    onProgress: (p) => {
                        if (options.onProgress) {
                            options.onProgress(trackId, {
                                status:
                                    p.phase === 'download_start' ? 'downloading' : 'downloading',
                                phase: p.phase === 'download' ? 'Downloading' : p.phase,
                                loaded: p.loaded,
                                total: p.total,
                                speed: p.speed
                            });

                            if (p.phase === 'tagging') {
                                options.onProgress(trackId, {
                                    status: 'processing',
                                    phase: 'Tagging'
                                });
                            } else if (p.phase === 'lyrics') {
                                options.onProgress(trackId, {
                                    status: 'processing',
                                    phase: 'Lyrics'
                                });
                            }
                        }
                    }
                });

                if (res.success) {
                    if (options.onProgress)
                        options.onProgress(trackId, {
                            status: 'done',
                            phase: 'Complete',
                            loaded: 100,
                            total: 100
                        });
                } else {
                    if (options.onProgress)
                        options.onProgress(trackId, {
                            status: 'failed',
                            phase: 'Failed',
                            error: res.error || 'Error'
                        });
                }
                return res;
            });
        });

        const results = await Promise.all(promises);

        return {
            success: results.every((r) => r.success),
            tracks: results,
            title: album?.title || 'Unknown Album',
            artist: album?.artist?.name || 'Unknown Artist',
            completedTracks: results.filter((r) => r.success).length,
            failedTracks: results.filter((r) => !r.success).length,
            totalTracks: results.length
        };
    }

    async downloadPlaylist(
        playlistId: string | number,
        quality = 27,
        options: AlbumDownloadOptions = {}
    ): Promise<DownloadResult> {
        const playlistInfo = await this.api.getPlaylist(playlistId);
        if (!playlistInfo.success) return { success: false, error: playlistInfo.error };
        const playlist = playlistInfo.data!;

        let tracks = playlist.tracks.items;
        if (options.trackIndices)
            tracks = tracks.filter((_: Track, i: number) => options.trackIndices!.includes(i));

        const limit = pLimit(CONFIG.download.concurrent);

        const promises = tracks.map((track) => {
            return limit(async () => {
                const trackId = track.id.toString();
                if (options.onProgress) {
                    options.onProgress(trackId, {
                        filename: `${track.track_number.toString().padStart(2, '0')}. ${track.title}`,
                        status: 'downloading',
                        phase: 'Starting'
                    });
                }

                const res = await this.downloadTrack(track.id, quality, {
                    skipExisting: options.skipExisting,
                    onProgress: (p) => {
                        if (options.onProgress) {
                            options.onProgress(trackId, {
                                phase: p.phase,
                                loaded: p.loaded,
                                total: p.total,
                                speed: p.speed,
                                status:
                                    p.phase === 'tagging' || p.phase === 'lyrics'
                                        ? 'processing'
                                        : 'downloading'
                            });
                        }
                    }
                });

                if (res.success) {
                    if (options.onProgress)
                        options.onProgress(trackId, { status: 'done', phase: 'Complete' });
                } else {
                    if (options.onProgress)
                        options.onProgress(trackId, { status: 'failed', phase: 'Failed' });
                }
                return res;
            });
        });

        const results = await Promise.all(promises);

        return {
            success: results.every((r) => r.success),
            tracks: results,
            title: playlist.name,
            totalTracks: results.length,
            completedTracks: results.filter((r) => r.success).length,
            failedTracks: results.filter((r) => !r.success).length
        };
    }

    async downloadArtist(
        artistId: string | number,
        quality = 27,
        options: AlbumDownloadOptions = {}
    ): Promise<DownloadResult> {
        const artistInfo = await this.api.getArtist(artistId);
        if (!artistInfo.success) return { success: false, error: artistInfo.error };
        const artist = artistInfo.data as Record<string, any>;

        const albums = artist.albums?.items || [];
        const results: DownloadResult[] = [];

        for (const album of albums) {
            if (options.onAlbumInfo) options.onAlbumInfo(album as Album);
            try {
                const res = await this.downloadAlbum(album.id, quality, options);
                results.push(res);
            } catch (e: unknown) {
                results.push({ success: false, error: (e as Error).message });
            }
        }

        return {
            success: results.every((r) => r.success),
            tracks: [],
            completedTracks: results.reduce((acc, r) => acc + (r.completedTracks || 0), 0),
            failedTracks: results.reduce((acc, r) => acc + (r.failedTracks || 0), 0),
            totalTracks: results.reduce((acc, r) => acc + (r.totalTracks || 0), 0)
        };
    }
}

export default DownloadService;
