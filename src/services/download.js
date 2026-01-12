import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { CONFIG } from '../config.js';
import QobuzAPI from '../api/qobuz.js';
import LyricsProvider from '../api/lyrics.js';
import MetadataService from './metadata.js';

class DownloadService {
    constructor() {
        this.api = new QobuzAPI();
        this.lyricsProvider = new LyricsProvider();
        this.metadataService = new MetadataService();
        this.outputDir = CONFIG.download.outputDir;
    }

    sanitizeFilename(name) {
        return name
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200);
    }

    buildFolderPath(metadata, quality) {
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

    buildFilename(metadata, extension) {
        const template = CONFIG.download.fileNaming;
        const trackNum = metadata.trackNumber?.toString().padStart(2, '0') || '00';

        const filename = template
            .replace('{trackNumber}', trackNum)
            .replace('{track_number}', trackNum)
            .replace('{title}', this.sanitizeFilename(metadata.title))
            .replace('{artist}', this.sanitizeFilename(metadata.artist))
            .replace('{album}', this.sanitizeFilename(metadata.album))
            .replace('{year}', metadata.year?.toString() || 'Unknown');

        return `${filename}.${extension}`;
    }

    async downloadCover(url, outputPath) {
        try {
            const highResUrl = url.replace(/_\d+\.jpg/, '_max.jpg').replace('/600/', '/1200/');

            const response = await axios({
                method: 'GET',
                url: highResUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });

            fs.writeFileSync(outputPath, response.data);
            return { success: true, buffer: response.data, path: outputPath };
        } catch (error) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 30000
                });

                fs.writeFileSync(outputPath, response.data);
                return { success: true, buffer: response.data, path: outputPath };
            } catch (e) {
                return { success: false, error: e.message };
            }
        }
    }

    async getCoverBuffer(url) {
        try {
            const highResUrl = url.replace(/_\d+\.jpg/, '_max.jpg').replace('/600/', '/1200/');

            const response = await axios({
                method: 'GET',
                url: highResUrl,
                responseType: 'arraybuffer',
                timeout: 30000
            });

            return response.data;
        } catch (error) {
            try {
                const response = await axios({
                    method: 'GET',
                    url: url,
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                return response.data;
            } catch (e) {
                return null;
            }
        }
    }

    async downloadTrack(trackId, quality = 27, options = {}) {
        const result = {
            success: false,
            trackId,
            title: '',
            artist: '',
            quality: quality,
            filePath: '',
            metadata: null,
            lyrics: null,
            error: null
        };

        try {
            const trackInfo = await this.api.getTrack(trackId);
            if (!trackInfo.success) {
                result.error = `Failed to get track info: ${trackInfo.error}`;
                return result;
            }

            const track = trackInfo.data;
            result.title = track.title;
            result.artist = track.performer?.name || track.artist?.name || 'Unknown';

            let albumData = track.album;
            if (track.album?.id) {
                const albumInfo = await this.api.getAlbum(track.album.id);
                if (albumInfo.success) {
                    albumData = albumInfo.data;
                }
            }

            const fileUrl = await this.api.getFileUrl(trackId, quality);
            if (!fileUrl.success) {
                result.error = `Failed to get file URL: ${fileUrl.error}`;
                return result;
            }

            const actualQuality = fileUrl.data.format_id || quality;
            const extension = CONFIG.quality.formats[actualQuality]?.extension || 'flac';

            let metadata = this.metadataService.extractMetadata(track, albumData, {
                bitDepth: fileUrl.data.bit_depth || 16,
                sampleRate: fileUrl.data.sampling_rate || 44.1
            });
            result.metadata = metadata;
            result.quality = actualQuality;

            let lyrics = null;
            if (CONFIG.metadata.embedLyrics) {
                const lyricsResult = await this.lyricsProvider.getLyrics(
                    track.title,
                    result.artist,
                    albumData?.title || '',
                    track.duration || 0
                );
                if (lyricsResult.success) {
                    lyrics = lyricsResult;
                    result.lyrics = lyrics;
                }
            }
            let enhancedMetadata = null;
            if (CONFIG.credentials.spotifyClientId) {
                if (options.onProgress)
                    options.onProgress({ phase: 'fetching_metadata', percent: 0 });
                enhancedMetadata = await this.metadataService.getEnhancedMetadata(
                    metadata.title,
                    metadata.artist,
                    metadata.album,
                    metadata.isrc
                );
                this.metadataService.applyEnhancedOverrides(metadata, enhancedMetadata);
            }

            const folderPath = path.join(
                this.outputDir,
                this.buildFolderPath(metadata, actualQuality)
            );
            fs.mkdirSync(folderPath, { recursive: true });

            const filename = this.buildFilename(metadata, extension);
            const filePath = path.join(folderPath, filename);
            result.filePath = filePath;

            if (lyrics?.syncedLyrics && CONFIG.metadata.saveLrcFile) {
                const lrcFilename = this.buildFilename(metadata, 'lrc');
                const lrcPath = path.join(folderPath, lrcFilename);

                const lrcContent = [
                    `[ti:${metadata.title}]`,
                    `[ar:${metadata.artist}]`,
                    `[al:${metadata.album}]`,
                    `[length:${metadata.durationFormatted || ''}]`,
                    '[by:Qobuz-DL CLI v2.0]',
                    '[re:LRCLIB]',
                    '',
                    lyrics.syncedLyrics
                ].join('\n');

                fs.writeFileSync(lrcPath, lrcContent, 'utf8');
            }

            if (options.onProgress) {
                options.onProgress({ phase: 'downloading', percent: 0 });
            }

            const response = await axios({
                method: 'GET',
                url: fileUrl.data.url,
                responseType: 'stream',
                timeout: 300000,
                onDownloadProgress: (progressEvent) => {
                    if (options.onProgress && progressEvent.total) {
                        const percent = Math.round(
                            (progressEvent.loaded / progressEvent.total) * 100
                        );
                        options.onProgress({
                            phase: 'downloading',
                            percent,
                            loaded: progressEvent.loaded,
                            total: progressEvent.total
                        });
                    }
                }
            });

            const totalSize = parseInt(response.headers['content-length'], 10) || 0;
            let downloadedSize = 0;

            const writer = createWriteStream(filePath);

            response.data.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (options.onProgress && totalSize) {
                    const percent = Math.round((downloadedSize / totalSize) * 100);
                    options.onProgress({
                        phase: 'downloading',
                        percent,
                        loaded: downloadedSize,
                        total: totalSize,
                        speed:
                            this.formatBytes(downloadedSize) + ' / ' + this.formatBytes(totalSize)
                    });
                }
            });

            await pipeline(response.data, writer);

            let coverBuffer = null;
            if (
                (CONFIG.metadata.embedCover || CONFIG.metadata.saveCoverFile) &&
                metadata.coverUrl
            ) {
                if (options.onProgress) {
                    options.onProgress({ phase: 'cover', percent: 0 });
                }
                coverBuffer = await this.getCoverBuffer(metadata.coverUrl);

                if (CONFIG.metadata.saveCoverFile) {
                    const coverPath = path.join(folderPath, 'cover.jpg');
                    if (coverBuffer && !fs.existsSync(coverPath)) {
                        fs.writeFileSync(coverPath, coverBuffer);
                    }
                }
            }

            if (options.onProgress) {
                options.onProgress({ phase: 'metadata', percent: 50 });
            }

            const finalCoverBuffer = CONFIG.metadata.embedCover ? coverBuffer : null;

            if (extension === 'mp3') {
                const id3Tags = this.metadataService.buildId3Tags(
                    metadata,
                    finalCoverBuffer,
                    lyrics
                );
                await this.metadataService.writeId3Tags(filePath, id3Tags);
            } else if (extension === 'flac') {
                const flacTags = this.metadataService.buildFlacTags(
                    metadata,
                    lyrics,
                    enhancedMetadata
                );
                await this.embedFlacMetadata(filePath, flacTags, finalCoverBuffer);
            }

            if (options.onProgress) {
                options.onProgress({ phase: 'complete', percent: 100 });
            }

            result.success = true;
            return result;
        } catch (error) {
            result.error = error.message;
            return result;
        }
    }

    async embedFlacMetadata(filePath, tags, coverBuffer) {
        try {
            const metaflacResult = await this.tryMetaflac(filePath, tags, coverBuffer);
            if (metaflacResult) {
                return;
            }

            await this.writeFlacMetadataPure(filePath, tags, coverBuffer);
        } catch (error) {
            console.error('Warning: Could not embed metadata, saving as sidecar file');
            const sidecarPath = filePath.replace('.flac', '.metadata.json');
            const metadata = {};
            for (const [key, value] of tags) {
                metadata[key] = value;
            }
            fs.writeFileSync(sidecarPath, JSON.stringify(metadata, null, 2));
        }
    }

    async tryMetaflac(filePath, tags, coverBuffer) {
        try {
            const { execSync } = await import('child_process');

            try {
                execSync('metaflac --version', { stdio: 'ignore' });
            } catch {
                return false;
            }

            execSync(`metaflac --remove-all-tags "${filePath}"`, { stdio: 'ignore' });

            for (const [key, value] of tags) {
                if (value) {
                    const escapedValue = String(value).replace(/"/g, '\\"');
                    execSync(`metaflac --set-tag="${key}=${escapedValue}" "${filePath}"`, {
                        stdio: 'ignore'
                    });
                }
            }

            if (coverBuffer) {
                const coverPath = filePath.replace('.flac', '_cover_temp.jpg');
                fs.writeFileSync(coverPath, coverBuffer);
                try {
                    execSync(`metaflac --import-picture-from="${coverPath}" "${filePath}"`, {
                        stdio: 'ignore'
                    });
                } finally {
                    if (fs.existsSync(coverPath)) {
                        fs.unlinkSync(coverPath);
                    }
                }
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    async writeFlacMetadataPure(filePath, tags, coverBuffer) {
        const flacData = fs.readFileSync(filePath);

        if (flacData.toString('utf8', 0, 4) !== 'fLaC') {
            throw new Error('Not a valid FLAC file');
        }

        const chunks = [];
        chunks.push(flacData.subarray(0, 4));

        let offset = 4;
        let foundStreamInfo = false;
        const metadataBlocks = [];

        while (offset < flacData.length) {
            const header = flacData[offset];
            const isLast = (header & 0x80) !== 0;
            const blockType = header & 0x7f;
            const blockLength = flacData.readUIntBE(offset + 1, 3);

            if (blockType === 127) break;

            const blockData = flacData.subarray(offset + 4, offset + 4 + blockLength);

            if (blockType === 0) {
                foundStreamInfo = true;
                metadataBlocks.push({ type: blockType, data: blockData, keep: true });
            } else if (blockType !== 4 && blockType !== 6) {
                metadataBlocks.push({ type: blockType, data: blockData, keep: true });
            }

            offset += 4 + blockLength;
            if (isLast) break;
        }

        if (!foundStreamInfo) {
            throw new Error('Invalid FLAC: no STREAMINFO block');
        }

        const audioData = flacData.subarray(offset);

        const vendorString = 'Qobuz-DL CLI v1.0';
        const vendorBuffer = Buffer.from(vendorString, 'utf8');
        const comments = [];

        for (const [key, value] of tags) {
            if (value) {
                comments.push(Buffer.from(`${key}=${value}`, 'utf8'));
            }
        }

        let vorbisSize = 4 + vendorBuffer.length + 4;
        for (const comment of comments) {
            vorbisSize += 4 + comment.length;
        }

        const vorbisData = Buffer.alloc(vorbisSize);
        let vOffset = 0;
        vorbisData.writeUInt32LE(vendorBuffer.length, vOffset);
        vOffset += 4;
        vendorBuffer.copy(vorbisData, vOffset);
        vOffset += vendorBuffer.length;
        vorbisData.writeUInt32LE(comments.length, vOffset);
        vOffset += 4;
        for (const comment of comments) {
            vorbisData.writeUInt32LE(comment.length, vOffset);
            vOffset += 4;
            comment.copy(vorbisData, vOffset);
            vOffset += comment.length;
        }

        let pictureData = null;
        if (coverBuffer && coverBuffer.length > 0) {
            const pictureType = 3;
            const mimeType = Buffer.from('image/jpeg', 'utf8');
            const description = Buffer.from('', 'utf8');

            const picSize =
                4 +
                4 +
                mimeType.length +
                4 +
                description.length +
                4 +
                4 +
                4 +
                4 +
                4 +
                coverBuffer.length;
            pictureData = Buffer.alloc(picSize);

            let pOffset = 0;
            pictureData.writeUInt32BE(pictureType, pOffset);
            pOffset += 4;
            pictureData.writeUInt32BE(mimeType.length, pOffset);
            pOffset += 4;
            mimeType.copy(pictureData, pOffset);
            pOffset += mimeType.length;
            pictureData.writeUInt32BE(description.length, pOffset);
            pOffset += 4;
            description.copy(pictureData, pOffset);
            pOffset += description.length;
            pictureData.writeUInt32BE(0, pOffset);
            pOffset += 4;
            pictureData.writeUInt32BE(0, pOffset);
            pOffset += 4;
            pictureData.writeUInt32BE(24, pOffset);
            pOffset += 4;
            pictureData.writeUInt32BE(0, pOffset);
            pOffset += 4;
            pictureData.writeUInt32BE(coverBuffer.length, pOffset);
            pOffset += 4;
            coverBuffer.copy(pictureData, pOffset);
        }

        const streamInfoBlock = metadataBlocks.find((b) => b.type === 0);
        const streamInfoHeader = Buffer.alloc(4);
        streamInfoHeader[0] = 0;
        streamInfoHeader.writeUIntBE(streamInfoBlock.data.length, 1, 3);
        chunks.push(streamInfoHeader);
        chunks.push(streamInfoBlock.data);

        for (const block of metadataBlocks.filter((b) => b.type !== 0 && b.keep)) {
            const blockHeader = Buffer.alloc(4);
            blockHeader[0] = block.type;
            blockHeader.writeUIntBE(block.data.length, 1, 3);
            chunks.push(blockHeader);
            chunks.push(block.data);
        }

        const vorbisHeader = Buffer.alloc(4);
        vorbisHeader[0] = pictureData ? 4 : 4 | 0x80;
        vorbisHeader.writeUIntBE(vorbisData.length, 1, 3);
        chunks.push(vorbisHeader);
        chunks.push(vorbisData);

        if (pictureData) {
            const pictureHeader = Buffer.alloc(4);
            pictureHeader[0] = 6 | 0x80;
            pictureHeader.writeUIntBE(pictureData.length, 1, 3);
            chunks.push(pictureHeader);
            chunks.push(pictureData);
        }

        chunks.push(audioData);

        const newFlacData = Buffer.concat(chunks);
        fs.writeFileSync(filePath, newFlacData);
    }

    async downloadAlbum(albumId, quality = 27, options = {}) {
        const results = {
            success: false,
            albumId,
            title: '',
            artist: '',
            tracks: [],
            totalTracks: 0,
            completedTracks: 0,
            failedTracks: 0,
            error: null
        };

        try {
            const albumInfo = await this.api.getAlbum(albumId);
            if (!albumInfo.success) {
                results.error = `Failed to get album info: ${albumInfo.error}`;
                return results;
            }

            const album = albumInfo.data;
            results.title = album.title;
            results.artist = album.artist?.name || 'Unknown';
            results.totalTracks = album.tracks?.items?.length || 0;

            if (options.onAlbumInfo) {
                options.onAlbumInfo(album);
            }

            const tracks = album.tracks?.items || [];

            let tracksToDownload = tracks;
            if (options.trackIndices && Array.isArray(options.trackIndices)) {
                tracksToDownload = tracks.filter((_, index) =>
                    options.trackIndices.includes(index)
                );
            }

            for (let i = 0; i < tracksToDownload.length; i++) {
                const track = tracksToDownload[i];

                if (options.onTrackStart) {
                    options.onTrackStart(track, i + 1, tracks.length);
                }

                const trackResult = await this.downloadTrack(track.id, quality, {
                    onProgress: options.onProgress
                });

                results.tracks.push(trackResult);

                if (trackResult.success) {
                    results.completedTracks++;
                } else {
                    results.failedTracks++;
                }

                if (options.onTrackComplete) {
                    options.onTrackComplete(trackResult, i + 1, tracks.length);
                }
            }

            if (album.goodies && album.goodies.length > 0) {
                const folderPath = path.join(
                    this.outputDir,
                    this.buildFolderPath(
                        {
                            albumArtist: results.artist,
                            album: results.title,
                            year: album.released_at
                                ? new Date(album.released_at * 1000).getFullYear()
                                : ''
                        },
                        quality
                    )
                );

                for (const goodie of album.goodies) {
                    if (goodie.url) {
                        try {
                            const ext = goodie.file_format === 'PDF' ? 'pdf' : 'jpg';
                            const goodiePath = path.join(
                                folderPath,
                                `${goodie.description || 'booklet'}.${ext}`
                            );

                            const response = await axios({
                                method: 'GET',
                                url: goodie.url,
                                responseType: 'arraybuffer',
                                timeout: 60000
                            });

                            fs.writeFileSync(goodiePath, response.data);
                        } catch (e) {
                            /* ignored */
                        }
                    }
                }
            }

            results.success = results.failedTracks === 0;
            return results;
        } catch (error) {
            results.error = error.message;
            return results;
        }
    }

    async downloadByUrl(url, quality = 27, options = {}) {
        const parsed = this.api.parseUrl(url);

        if (!parsed) {
            return { success: false, error: 'Invalid Qobuz URL' };
        }

        switch (parsed.type) {
            case 'track':
                return this.downloadTrack(parsed.id, quality, options);
            case 'album':
                return this.downloadAlbum(parsed.id, quality, options);
            case 'artist':
                return {
                    success: false,
                    error: 'Artist download not implemented yet. Please provide an album URL.'
                };
            case 'playlist':
                return { success: false, error: 'Playlist download not implemented yet.' };
            default:
                return { success: false, error: 'Unknown URL type' };
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

export default DownloadService;
