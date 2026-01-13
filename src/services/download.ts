import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService, { Metadata } from './metadata.js';
import { settingsService } from './settings.js';
import pLimit from 'p-limit';
import flac from 'flac-metadata';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import { Track, LyricsResult, Album } from '../types/qobuz.js';

interface DownloadOptions {
    outputDir?: string;
    onProgress?: (
        phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging',
        loaded: number,
        total?: number
    ) => void;
    trackIndices?: number[];
}

export interface AlbumDownloadOptions {
    trackIndices?: number[];
    onTrackStart?: (track: Track, num: number, total: number) => void;
    onTrackComplete?: (result: DownloadResult) => void;
    onProgress?: (phase: string, loaded: number, total?: number) => void;
    batch?: boolean;
}

export interface ArtistDownloadOptions {
    onAlbumInfo?: (album: Album) => void;
    onTrackStart?: (track: Track, num: number, total: number) => void;
    onTrackComplete?: (result: DownloadResult) => void;
    onProgress?: (phase: string, loaded: number, total?: number) => void;
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
}

class DownloadService {
    api: QobuzAPI;
    lyricsProvider: LyricsProvider;
    metadataService: MetadataService;
    outputDir: string;

    constructor() {
        this.api = new QobuzAPI();
        this.lyricsProvider = new LyricsProvider();
        this.metadataService = new MetadataService();
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

        try {
            const trackInfo = await this.api.getTrack(trackId);
            if (!trackInfo.success) throw new Error(`Track Info Error: ${trackInfo.error}`);
            const track = trackInfo.data;

            const fileUrl = await this.api.getFileUrl(trackId, quality);
            if (!fileUrl.success) throw new Error(`File URL Error: ${fileUrl.error}`);

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
            result.metadata = metadata;

            const rootDir = options.outputDir || this.outputDir;
            const folderPath = path.join(rootDir, this.buildFolderPath(metadata, actualQuality));
            fs.mkdirSync(folderPath, { recursive: true });

            const filePath = path.join(folderPath, this.buildFilename(metadata, extension));
            result.filePath = filePath;

            let lyrics = null;
            if (embedLyrics) {
                if (options.onProgress) options.onProgress('lyrics', 0);
                const lyricsRes = await this.lyricsProvider.getLyrics(
                    track!.title,
                    metadata.artist,
                    metadata.album,
                    track!.duration
                );
                if (lyricsRes.success) lyrics = lyricsRes;
            }

            if (options.onProgress) options.onProgress('download_start', 0);

            const fileStreamData = fileUrl.data as { url: string };
            const response = await axios({
                method: 'GET',
                url: fileStreamData.url,
                responseType: 'stream',
                timeout: 300000
            });

            const totalSize = parseInt(response.headers['content-length'], 10);
            const writer = createWriteStream(filePath);

            let downloaded = 0;
            response.data.on('data', (chunk: Buffer) => {
                downloaded += chunk.length;
                if (options.onProgress) options.onProgress('download', downloaded, totalSize);
            });

            await pipeline(response.data, writer);

            if (options.onProgress) options.onProgress('cover', 0);
            const coverBuffer =
                embedCover || CONFIG.metadata.saveCoverFile
                    ? await this.getCoverBuffer(metadata.coverUrl)
                    : null;

            if (coverBuffer && CONFIG.metadata.saveCoverFile) {
                fs.writeFileSync(path.join(folderPath, 'cover.jpg'), coverBuffer);
            }

            if (options.onProgress) options.onProgress('tagging', 0);
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
            return result;
        } catch (error: unknown) {
            result.error = (error as Error).message;
            return result;
        }
    }

    async embedFlacMetadata(filePath: string, tags: string[][], coverBuffer: Buffer | null) {
        try {
            const { execSync } = await import('child_process');
            try {
                execSync('metaflac --version', { stdio: 'ignore' });

                execSync(`metaflac --remove-all-tags "${filePath}"`, { stdio: 'ignore' });
                for (const [key, value] of tags) {
                    if (value) {
                        const escaped = String(value).replace(/"/g, '\\"');
                        execSync(`metaflac --set-tag="${key}=${escaped}" "${filePath}"`, {
                            stdio: 'ignore'
                        });
                    }
                }
                if (coverBuffer) {
                    const coverPath = filePath + '.cover.jpg';
                    fs.writeFileSync(coverPath, coverBuffer);
                    execSync(`metaflac --import-picture-from="${coverPath}" "${filePath}"`, {
                        stdio: 'ignore'
                    });
                    fs.unlinkSync(coverPath);
                }
                return;
            } catch (e) {
                void e;
            }

            console.log('    ℹ️  Using JS fallback for FLAC tagging...');
            const tempPath = filePath + '.tmp';
            const reader = fs.createReadStream(filePath);
            const writer = fs.createWriteStream(tempPath);

            const processor = new flac.Processor({ parseMetaDataBlocks: true });

            let tagsAdded = false;

            processor.on('preprocess', (mdb: any) => {
                if (mdb.type === flac.Processor.MDB_TYPE_VORBIS_COMMENT) {
                    mdb.remove();
                }
                if (coverBuffer && mdb.type === flac.Processor.MDB_TYPE_PICTURE) {
                    mdb.remove();
                }
            });

            processor.on('postprocess', (mdb: any) => {
                if (mdb.type === flac.Processor.MDB_TYPE_STREAMINFO && !tagsAdded) {
                    tagsAdded = true;

                    const vorbisComment = flac.data.MetaDataBlockVorbisComment.create(
                        false,
                        'Qobuz-DL',
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

            fs.unlinkSync(filePath);
            fs.renameSync(tempPath, filePath);
        } catch (error: unknown) {
            console.error('Tagging Error:', (error as Error).message);
        }
    }

    async downloadAlbum(
        albumId: string | number,
        quality = 27,
        options: AlbumDownloadOptions = {}
    ): Promise<DownloadResult> {
        const multibar = new cliProgress.MultiBar(
            {
                clearOnComplete: false,
                hideCursor: true,
                format: ' {bar} | {percentage}% | {value}/{total} | {status} | {filename}',
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591'
            },
            cliProgress.Presets.shades_classic
        );

        const albumInfo = await this.api.getAlbum(albumId);
        if (!albumInfo.success) return { success: false, error: albumInfo.error };
        const album = albumInfo.data;

        const tracksItems = album?.tracks?.items || [];
        let tracks: any[] = tracksItems;
        if (options.trackIndices)
            tracks = tracks.filter((_: unknown, i: number) => options.trackIndices!.includes(i));

        const limit = pLimit(CONFIG.download.concurrent);

        console.log(
            chalk.bold.cyan(`\n📥 Downloading ${tracks.length} tracks from "${album!.title}"\n`)
        );

        const promises = tracks.map((track) => {
            return limit(async () => {
                const trackNum = track.track_number.toString().padStart(2, '0');
                if (options.onTrackStart)
                    options.onTrackStart(track, parseInt(track.track_number), tracks.length);
                const bar = multibar.create(100, 0, {
                    status: 'Starting',
                    filename: `${trackNum}. ${track.title.substring(0, 20)}...`
                });

                const res = await this.downloadTrack(track.id, quality, {
                    onProgress: (phase, loaded, total) => {
                        if (phase === 'download' && total) {
                            bar.setTotal(total);
                            bar.update(loaded, { status: chalk.cyan('Downloading') });
                        } else if (phase === 'tagging') {
                            bar.update(100, { status: chalk.magenta('Tagging') });
                        } else if (phase === 'lyrics') {
                            bar.update(0, { status: chalk.yellow('Lyrics') });
                        }
                        if (options.onProgress) options.onProgress(phase, loaded, total);
                    }
                });

                if (res.success) {
                    bar.update(bar.getTotal(), { status: chalk.green('Done') });
                    if (options.onTrackComplete) options.onTrackComplete(res);
                } else {
                    bar.update(bar.getTotal(), { status: chalk.red('Failed') });
                    if (options.onTrackComplete) options.onTrackComplete(res);
                }
                return res;
            });
        });

        const results = await Promise.all(promises);
        multibar.stop();

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
        const multibar = new cliProgress.MultiBar(
            {
                clearOnComplete: false,
                hideCursor: true,
                format: ' {bar} | {percentage}% | {value}/{total} | {status} | {filename}',
                barCompleteChar: '\u2588',
                barIncompleteChar: '\u2591'
            },
            cliProgress.Presets.shades_classic
        );

        const playlistInfo = await this.api.getPlaylist(playlistId);
        if (!playlistInfo.success) return { success: false, error: playlistInfo.error };
        const playlist = playlistInfo.data!;

        let tracks = playlist.tracks.items;
        if (options.trackIndices)
            tracks = tracks.filter((_: Track, i: number) => options.trackIndices!.includes(i));

        const limit = pLimit(CONFIG.download.concurrent);

        console.log(
            chalk.bold.cyan(
                `\n📥 Downloading ${tracks.length} tracks from playlist "${playlist.name}"\n`
            )
        );

        const promises = tracks.map((track) => {
            return limit(async () => {
                const trackNum = (tracks.indexOf(track) + 1).toString().padStart(2, '0');
                if (options.onTrackStart)
                    options.onTrackStart(track, parseInt(trackNum), tracks.length);
                const bar = multibar.create(100, 0, {
                    status: 'Starting',
                    filename: `${trackNum}. ${track.title.substring(0, 20)}...`
                });

                const res = await this.downloadTrack(track.id, quality, {
                    onProgress: (phase, loaded, total) => {
                        if (phase === 'download' && total) {
                            bar.setTotal(total);
                            bar.update(loaded, { status: chalk.cyan('Downloading') });
                        } else if (phase === 'tagging') {
                            bar.update(100, { status: chalk.magenta('Tagging') });
                        } else if (phase === 'lyrics') {
                            bar.update(0, { status: chalk.yellow('Lyrics') });
                        }
                        if (options.onProgress) options.onProgress(phase, loaded, total);
                    }
                });

                if (res.success) {
                    bar.update(bar.getTotal(), { status: chalk.green('Done') });
                    if (options.onTrackComplete) options.onTrackComplete(res);
                } else {
                    bar.update(bar.getTotal(), { status: chalk.red('Failed') });
                    if (options.onTrackComplete) options.onTrackComplete(res);
                }
                return res;
            });
        });

        const results = await Promise.all(promises);
        multibar.stop();

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
        options: ArtistDownloadOptions = {}
    ): Promise<DownloadResult> {
        const artistInfo = await this.api.getArtist(artistId);
        if (!artistInfo.success) return { success: false, error: artistInfo.error };
        const artist = artistInfo.data as Record<string, any>;

        const albums = artist.albums?.items || [];
        const results: DownloadResult[] = [];

        console.log(
            chalk.bold.cyan(
                `\n📥 Downloading discography for "${artist.name}" (${albums.length} albums)\n`
            )
        );

        for (const album of albums) {
            if (options.onAlbumInfo) options.onAlbumInfo(album as Album);

            try {
                const res = await this.downloadAlbum(album.id, quality, {
                    onTrackStart: options.onTrackStart,
                    onTrackComplete: options.onTrackComplete,
                    onProgress: options.onProgress
                });
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
