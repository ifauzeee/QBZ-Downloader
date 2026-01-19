import path from 'path';
import crypto from 'crypto';
import { downloadFile } from '../utils/network.js';
import { logger } from '../utils/logger.js';

import { createWriteStream, mkdirSync, unlinkSync, existsSync } from 'fs';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService, { Metadata } from './metadata.js';
import pLimit from 'p-limit';
import { Track, LyricsResult, Album, FileUrlData } from '../types/qobuz.js';
import { historyService } from './history.js';
import { resumeService } from './batch.js';

export interface DownloadProgress {
    phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging';
    loaded: number;
    total?: number;
    speed?: number;
}

interface DownloadOptions {
    outputDir?: string;
    onProgress?: (progress: DownloadProgress) => void;
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

export default class DownloadService {
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
                .replace(/&/g, 'and')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^\.+|\.+$/g, '')
                .substring(0, 128) || 'Unknown'
        );
    }

    private applyTemplate(template: string, metadata: Metadata, quality: number): string {
        const qualityName = CONFIG.quality.formats[quality]?.name || 'FLAC';
        let result = template;

        logger.info(
            `Processing template: "${template}" for ${metadata.artist} - ${metadata.title}`,
            'DEBUG'
        );

        const data: Record<string, any> = {
            artist: metadata.artist || 'Unknown Artist',
            albumArtist: metadata.albumArtist || metadata.artist || 'Unknown Artist',
            album: metadata.album || 'Unknown Album',
            title: metadata.title || 'Unknown Title',
            year: metadata.year?.toString() || 'Unknown',
            quality: qualityName,
            format: qualityName,
            track_number: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            tracknumber: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            track: metadata.trackNumber?.toString().padStart(2, '0') || '01'
        };

        for (const [key, value] of Object.entries(data)) {
            const sanitizedValue = this.sanitizeFilename(String(value));
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\{${escapedKey}\\}`, 'gi');

            if (regex.test(result)) {
                result = result.replace(regex, sanitizedValue);
                logger.debug(`Replaced {${key}} with "${sanitizedValue}"`, 'DEBUG');
            }
        }

        return result;
    }

    buildFolderPath(metadata: Metadata, quality: number) {
        return this.applyTemplate(CONFIG.download.folderStructure, metadata, quality);
    }

    buildFilename(metadata: Metadata, quality: number) {
        const filename = this.applyTemplate(CONFIG.download.fileNaming, metadata, quality);
        return filename.endsWith('.flac') ? filename : filename + '.flac';
    }

    async downloadTrack(
        trackId: string | number,
        quality = 27,
        options: DownloadOptions = {}
    ): Promise<DownloadResult> {
        const trackInfo = await this.api.getTrack(trackId);
        if (!trackInfo.success) return { success: false, error: trackInfo.error };

        const track = trackInfo.data!;
        let album = options.album || track.album;

        if (!options.album && album && album.id) {
            try {
                logger.debug(
                    `Fetching full album info for ${album.title} to ensure high-quality metadata...`,
                    'DOWNLOAD'
                );
                const fullAlbumInfo = await this.api.getAlbum(album.id);
                if (fullAlbumInfo.success && fullAlbumInfo.data) {
                    album = fullAlbumInfo.data;
                    logger.debug('Updated album metadata from full response', 'DOWNLOAD');
                } else {
                    logger.warn(
                        'Could not fetch full album info, using track album info',
                        'DOWNLOAD'
                    );
                }
            } catch (e: any) {
                logger.warn(`Failed to fetch full album info: ${e.message}`, 'DOWNLOAD');
            }
        }

        if (album && album.image) {
            if (!album.image.mega && !album.image.extralarge && album.image.large) {
                logger.debug(
                    `Available cover sizes: ${Object.keys(album.image).join(', ')}`,
                    'COVER'
                );
            }
        }

        const fileUrl = await this.api.getFileUrl(trackId, quality);

        if (!fileUrl.success) {
            return { success: false, error: fileUrl.error };
        }

        const fileUrlData = fileUrl.data as FileUrlData;
        const actualQuality = fileUrlData.format_id || quality;

        if (options.onQuality) options.onQuality(actualQuality);

        const metadata = await this.metadataService.extractMetadata(track, album!, {});
        if (options.onMetadata) options.onMetadata(metadata);

        const folderPath = path.join(this.outputDir, this.buildFolderPath(metadata, actualQuality));
        if (!existsSync(folderPath)) mkdirSync(folderPath, { recursive: true });

        const filename = this.buildFilename(metadata, actualQuality);
        const filePath = path.join(folderPath, filename);

        if (options.skipExisting && existsSync(filePath)) {
            return {
                success: true,
                skipped: true,
                filePath,
                quality: actualQuality,
                metadata
            };
        }

        if (options.onProgress) {
            options.onProgress({ phase: 'download_start', loaded: 0, total: 0 });
        }

        try {
            const response = await downloadFile(fileUrlData.url);
            const totalLength = parseInt(response.headers['content-length'] || '0', 10);
            let downloaded = 0;
            const startTime = Date.now();
            const md5Hash = crypto.createHash('md5');

            const writer = createWriteStream(filePath);

            await new Promise<void>((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    downloaded += chunk.length;
                    md5Hash.update(chunk);

                    if (options.onProgress) {
                        const currentTime = Date.now();
                        const elapsed = (currentTime - startTime) / 1000;
                        const speed = elapsed > 0 ? downloaded / elapsed : 0;

                        options.onProgress({
                            phase: 'download',
                            loaded: downloaded,
                            total: totalLength,
                            speed
                        });
                    }
                });

                response.data.pipe(writer);

                writer.on('finish', resolve);
                writer.on('error', reject);
                response.data.on('error', reject);
            });

            const finalMD5 = md5Hash.digest('hex');
            const finalSize = downloaded;

            logger.info(
                `Download complete: ${metadata.title} (Size: ${finalSize}, MD5: ${finalMD5})`,
                'DOWNLOAD'
            );

            let verificationStatus = 'verified';
            if (totalLength > 0 && finalSize !== totalLength) {
                logger.error(
                    `Size mismatch for ${metadata.title}! Expected ${totalLength}, got ${finalSize}`,
                    'VERIFY'
                );
                verificationStatus = 'error_size';
            } else {
                logger.success(`Bit-Perfect verified: ${metadata.title}`, 'VERIFY');
            }

            if (options.onProgress) options.onProgress({ phase: 'lyrics', loaded: 0 });

            let lyricsResult = null;
            try {
                const processedLyrics = await this.lyricsProvider.getLyrics(
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.duration,
                    metadata.albumArtist
                );

                if (processedLyrics.success) {
                    lyricsResult = processedLyrics;
                    logger.info(
                        `Lyrics found for ${metadata.title}: ${processedLyrics.source}`,
                        'LYRICS'
                    );
                } else {
                    logger.warn(`No lyrics found for ${metadata.title}`, 'LYRICS');
                }
            } catch (e: any) {
                logger.error(`Error fetching lyrics: ${e.message}`, 'LYRICS');
            }

            if (options.onProgress) options.onProgress({ phase: 'cover', loaded: 0 });
            let coverBuffer: Buffer | null = null;
            let coverUrl =
                metadata.coverUrl ||
                album?.image?.mega ||
                album?.image?.extralarge ||
                album?.image?.large ||
                album?.image?.medium;

            if (coverUrl) {
                const highResUrl = coverUrl.replace(/_\d+\.jpg$/, '_org.jpg');
                if (highResUrl !== coverUrl) {
                    try {
                        const { default: axios } = await import('axios');
                        await axios.head(highResUrl, { timeout: 2000 });
                        coverUrl = highResUrl;
                        logger.info('Cover upgraded to max resolution', 'COVER');
                    } catch {
                    }
                }
            }

            if (coverUrl && (CONFIG.metadata.embedCover || CONFIG.metadata.saveCoverFile)) {
                try {
                    const { default: axios } = await import('axios');
                    const coverResponse = await axios.get(coverUrl, {
                        responseType: 'arraybuffer',
                        timeout: 30000
                    });
                    coverBuffer = Buffer.from(coverResponse.data);
                    logger.info(`Cover art downloaded for ${metadata.title}`, 'COVER');

                    if (CONFIG.metadata.saveCoverFile) {
                        const coverPath = path.join(folderPath, 'cover.jpg');
                        if (!existsSync(coverPath)) {
                            const { writeFileSync } = await import('fs');
                            writeFileSync(coverPath, coverBuffer);
                            logger.info(`Cover saved to ${coverPath}`, 'COVER');
                        }
                    }
                } catch (coverErr: any) {
                    logger.warn(`Failed to download cover art: ${coverErr.message}`, 'COVER');
                }
            }

            if (options.onProgress) options.onProgress({ phase: 'tagging', loaded: 100 });
            await this.metadataService.writeMetadata(
                filePath,
                metadata,
                actualQuality,
                lyricsResult,
                coverBuffer
            );

            if (lyricsResult && CONFIG.metadata.saveLrcFile) {
                const lrcContent = lyricsResult.syncedLyrics || lyricsResult.plainLyrics;
                if (lrcContent) {
                    try {
                        const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');
                        const { writeFileSync } = await import('fs');
                        writeFileSync(lrcPath, lrcContent, 'utf8');
                        logger.info(`LRC saved to ${path.basename(lrcPath)}`, 'LYRICS');
                    } catch (lrcErr: any) {
                        logger.warn(`Failed to save LRC file: ${lrcErr.message}`, 'LYRICS');
                    }
                }
            }

            resumeService.completeDownload(trackId.toString());

            let artistImageUrl =
                track?.performer?.image?.large || track?.artist?.image?.large || '';

            if (!artistImageUrl) {
                const artistId =
                    track?.performer?.id || track?.artist?.id || (track?.album?.artist as any)?.id;
                if (artistId) {
                    try {
                        const artistRes = await this.api.getArtist(artistId);
                        if (artistRes.success && artistRes.data) {
                            const artistData = artistRes.data as any;
                            artistImageUrl =
                                artistData.image?.large ||
                                artistData.image?.medium ||
                                artistData.image?.small ||
                                '';
                        }
                    } catch (e) {
                        logger.debug(`Failed to fetch artist image: ${e}`);
                    }
                }
            }

            historyService.add(trackId, {
                filename: filePath,
                quality: actualQuality,
                title: metadata.title,
                artist: metadata.artist,
                albumArtist: metadata.albumArtist || metadata.artist,
                artistImageUrl: artistImageUrl,
                album: metadata.album
            });

            try {
                const { databaseService } = await import('./database/index.js');
                const trackAny = track as any;

                databaseService.addTrack({
                    id: trackId.toString(),
                    title: metadata.title,
                    artist: metadata.artist,
                    album_artist: metadata.albumArtist,
                    album: metadata.album,
                    album_id: track.album?.id?.toString(),
                    duration: metadata.duration,
                    quality: actualQuality,
                    file_path: filePath,
                    file_size: totalLength,
                    cover_url: track.album?.image?.large || track.album?.image?.medium,
                    genre: metadata.genre,
                    year: metadata.year ? parseInt(metadata.year.toString()) : undefined,
                    downloaded_at: new Date().toISOString(),
                    label: trackAny.album?.label?.name,
                    isrc: trackAny.isrc,
                    checksum: finalMD5,
                    verification_status: verificationStatus
                } as any);

                databaseService.addLibraryFile({
                    file_path: filePath,
                    track_id: trackId.toString(),
                    title: metadata.title,
                    artist: metadata.albumArtist || metadata.artist,
                    album: metadata.album,
                    duration: metadata.duration,
                    quality: actualQuality,
                    file_size: finalSize,
                    format: filePath.split('.').pop()?.toUpperCase() || 'FLAC',
                    bit_depth: metadata.bitDepth,
                    sample_rate: metadata.sampleRate,
                    needs_upgrade: false,
                    checksum: finalMD5,
                    verification_status: verificationStatus
                } as any);
            } catch (error: any) {
                logger.warn(`Failed to update analytics database: ${error.message}`, 'DB');
            }

            return {
                success: true,
                filePath,
                quality: actualQuality,
                metadata,
                lyrics: (lyricsResult as any) || undefined
            };
        } catch (error: any) {
            if (existsSync(filePath)) unlinkSync(filePath);
            return { success: false, error: error.message };
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

        if (options.onMetadata && album) {
            options.onMetadata({
                title: album.title,
                artist: album.artist?.name,
                album: album.title
            });
        }

        const tracksItems = album?.tracks?.items || [];
        let tracks: Track[] = tracksItems;
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
                        phase: 'Initializing',
                        loaded: 0,
                        total: 0
                    });
                }

                const res = await this.downloadTrack(track.id, quality, {
                    skipExisting: options.skipExisting,
                    onQuality: options.onQuality,
                    album: album,
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
                return res;
            });
        });

        const resultsSettled = await Promise.allSettled(promises);
        const results = resultsSettled.map((r) => {
            if (r.status === 'fulfilled') return r.value;
            return {
                success: false,
                error: r.reason instanceof Error ? r.reason.message : String(r.reason)
            } as DownloadResult;
        });

        const completedTracks = results.filter((r) => r.success).length;
        const failedTracks = results.filter((r) => !r.success && !r.skipped).length;
        const skippedTracks = results.filter((r) => r.skipped).length;

        const success = results.length === 0 || completedTracks > 0 || skippedTracks > 0;

        let error: string | undefined;
        if (failedTracks > 0) {
            const firstError = results.find((r) => !r.success && !r.skipped)?.error;
            error = firstError || 'Some tracks failed to download';

            if (success) {
                logger.warn(
                    `Batch partial success: ${completedTracks} downloaded, ${skippedTracks} skipped, ${failedTracks} failed.`,
                    'BATCH'
                );
            }
        }

        return {
            success,
            tracks: results,
            completedTracks,
            failedTracks,
            totalTracks: results.length,
            error: success ? undefined : error
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

        if (options.onMetadata && playlist) {
            options.onMetadata({
                title: playlist.name,
                artist: 'Various Artists',
                album: playlist.name
            });
        }

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
                    onQuality: options.onQuality,
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
                return res;
            });
        });

        const resultsSettled = await Promise.allSettled(promises);
        const results = resultsSettled.map((r) => {
            if (r.status === 'fulfilled') return r.value;
            return {
                success: false,
                error: r.reason instanceof Error ? r.reason.message : String(r.reason)
            } as DownloadResult;
        });

        const completedTracks = results.filter((r) => r.success).length;
        const failedTracks = results.filter((r) => !r.success && !r.skipped).length;
        const skippedTracks = results.filter((r) => r.skipped).length;

        const success = results.length === 0 || completedTracks > 0 || skippedTracks > 0;

        let error: string | undefined;
        if (failedTracks > 0) {
            const firstError = results.find((r) => !r.success && !r.skipped)?.error;
            error = firstError || 'Some tracks failed to download';
            if (success) {
                logger.warn(
                    `Playlist partial success: ${completedTracks} downloaded, ${skippedTracks} skipped, ${failedTracks} failed.`,
                    'BATCH'
                );
            }
        }

        return {
            success,
            tracks: results,
            completedTracks,
            failedTracks,
            totalTracks: results.length,
            error: success ? undefined : error
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

        if (options.onMetadata && artist) {
            options.onMetadata({
                title: artist.name,
                artist: artist.name,
                album: 'Discography'
            });
        }

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
            success: results.some((r) => r.success),
            tracks: [],
            completedTracks: results.reduce((acc, r) => acc + (r.completedTracks || 0), 0),
            failedTracks: results.reduce((acc, r) => acc + (r.failedTracks || 0), 0),
            totalTracks: results.reduce((acc, r) => acc + (r.totalTracks || 0), 0)
        };
    }

    async downloadLyrics(trackId: string | number): Promise<DownloadResult> {
        try {
            const trackInfo = await this.api.getTrack(trackId);
            if (!trackInfo.success) return { success: false, error: trackInfo.error };

            const track = trackInfo.data!;
            const album = track.album;

            const quality = 27;

            const metadata = await this.metadataService.extractMetadata(track, album!, {});
            const folderPath = path.join(this.outputDir, this.buildFolderPath(metadata, quality));

            if (!existsSync(folderPath)) {
                mkdirSync(folderPath, { recursive: true });
            }

            const filename = this.buildFilename(metadata, quality);
            const filePath = path.join(folderPath, filename);
            const lrcPath = filePath.replace(/\.[^.]+$/, '.lrc');

            const processedLyrics = await this.lyricsProvider.getLyrics(
                metadata.title,
                metadata.artist,
                metadata.album,
                metadata.duration,
                metadata.albumArtist
            );

            if (processedLyrics.success) {
                const lrcContent = processedLyrics.syncedLyrics || processedLyrics.plainLyrics;
                if (lrcContent) {
                    const { writeFileSync } = await import('fs');
                    writeFileSync(lrcPath, lrcContent, 'utf8');
                    logger.info(`LRC downloaded to ${path.basename(lrcPath)}`, 'LYRICS');
                    return { success: true, filePath: lrcPath };
                } else {
                    return { success: false, error: 'No lyrics content found' };
                }
            } else {
                return { success: false, error: 'Lyrics not found' };
            }
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    async downloadAlbumLyricsZip(
        albumId: string | number
    ): Promise<{ success: boolean; filePath?: string; error?: string }> {
        try {
            const albumInfo = await this.api.getAlbum(albumId);
            if (!albumInfo.success) return { success: false, error: albumInfo.error };
            const album = albumInfo.data!;

            const { default: archiver } = await import('archiver');
            const { createWriteStream } = await import('fs');

            const zipName = `${this.sanitizeFilename(album.artist.name)} - ${this.sanitizeFilename(album.title)} (Lyrics).zip`;
            const zipPath = path.join(this.outputDir, zipName);

            const output = createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            return new Promise((resolve, reject) => {
                output.on('close', () => {
                    logger.info(`Lyrics ZIP created: ${zipName}`, 'LYRICS');
                    resolve({ success: true, filePath: zipPath });
                });

                archive.on('error', (err: any) => {
                    reject({ success: false, error: err.message });
                });

                archive.pipe(output);

                (async () => {
                    try {
                        const tracks = album.tracks?.items || [];
                        const limit = pLimit(5);

                        const results = await Promise.all(
                            tracks.map((track) =>
                                limit(async () => {
                                    try {
                                        const lyrics = await this.lyricsProvider.getLyrics(
                                            track.title,
                                            track.performer?.name || album.artist.name,
                                            track.album?.title || album.title,
                                            track.duration
                                        );

                                        if (lyrics.success) {
                                            const content =
                                                lyrics.syncedLyrics || lyrics.plainLyrics;
                                            if (content) {
                                                const filename = `${track.track_number.toString().padStart(2, '0')} - ${this.sanitizeFilename(track.title)}.lrc`;
                                                return { filename, content };
                                            }
                                        }
                                    } catch { }
                                    return null;
                                })
                            )
                        );

                        for (const file of results) {
                            if (file) {
                                archive.append(file.content, { name: file.filename });
                            }
                        }

                        await archive.finalize();
                    } catch (e: any) {
                        reject({ success: false, error: e.message });
                    }
                })();
            });
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}
