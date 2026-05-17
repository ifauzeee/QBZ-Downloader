import { parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { parseFile } from 'music-metadata';
import type { IAudioMetadata } from 'music-metadata';

import { resolveBinaryPath } from '../../utils/binaries.js';

function getAudioFingerprint(filePath: string): string | undefined {
    try {
        const fpcalc = resolveBinaryPath('fpcalc');
        const stdout = execSync(`"${fpcalc}" -json "${filePath}"`, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const data = JSON.parse(stdout);
        return data.fingerprint;
    } catch {
        return undefined;
    }
}

function hasLyricsMetadata(metadata: IAudioMetadata): boolean {
    if (
        metadata.common.lyrics?.some((line: unknown) =>
            String(typeof line === 'string' ? line : (line as { text?: string })?.text || '').trim()
        )
    ) {
        return true;
    }

    const lyricTagNames = new Set([
        'lyrics',
        'syncedlyrics',
        'unsyncedlyrics',
        'synchronisedlyrics',
        'unsynchronisedlyrics',
        'uslt',
        'sylt'
    ]);

    return Object.values(metadata.native || {}).some((tags) =>
        tags.some((tag) => {
            const id = tag.id.toLowerCase();
            if (!lyricTagNames.has(id)) return false;
            const value = Array.isArray(tag.value) ? tag.value.join('\n') : tag.value;
            return String(value || '').trim().length > 0;
        })
    );
}

parentPort?.on('message', async (filePath: string) => {
    try {
        const stats = await fs.promises.stat(filePath);
        const ext = path.extname(filePath).toLowerCase();

        const filename = path.basename(filePath, ext);
        const parentDir = path.basename(path.dirname(filePath));
        const artistDir = path.basename(path.dirname(path.dirname(filePath)));

        let title = filename;
        let artist = artistDir || 'Unknown';
        let albumArtist = artistDir || 'Unknown';
        let album = parentDir || 'Unknown';
        let quality = 6;
        let bitDepth = 16;
        let sampleRate = 44100;
        let duration = 0;
        const missingTags: string[] = [];

        try {
            const metadata = await parseFile(filePath);

            if (metadata.format) {
                duration = metadata.format.duration || 0;
                sampleRate = metadata.format.sampleRate || 44100;
                bitDepth = metadata.format.bitsPerSample || 16;

                if (metadata.format.lossless || ['.flac', '.wav', '.aiff'].includes(ext)) {
                    if (bitDepth >= 24 && sampleRate >= 192000) quality = 27;
                    else if (bitDepth >= 24 && sampleRate >= 96000) quality = 7;
                    else if (bitDepth >= 24) quality = 7;
                    else quality = 6;
                } else if (metadata.format.bitrate && metadata.format.bitrate >= 320000) {
                    quality = 5;
                } else {
                    quality = 5;
                }
            }

            if (metadata.common) {
                if (metadata.common.title) title = metadata.common.title;
                else missingTags.push('Title');

                if (metadata.common.artist) artist = metadata.common.artist;
                else missingTags.push('Artist');

                if (metadata.common.albumartist) albumArtist = metadata.common.albumartist;

                if (metadata.common.album) album = metadata.common.album;
                else missingTags.push('Album');

                if (!metadata.common.picture || metadata.common.picture.length === 0)
                    missingTags.push('Cover Art');
                if (!hasLyricsMetadata(metadata)) missingTags.push('Lyrics');
                if (!metadata.common.genre || metadata.common.genre.length === 0)
                    missingTags.push('Genre');
                if (!metadata.common.year && !metadata.common.date) missingTags.push('Year');
            } else {
                missingTags.push('All Metadata');
            }
        } catch {
            missingTags.push('Unreadable');
            if (ext === '.flac') {
                const mbPerMinute = stats.size / (1024 * 1024) / (duration / 60 || 4);
                if (mbPerMinute > 20) {
                    quality = 27;
                    bitDepth = 24;
                    sampleRate = 192000;
                } else if (mbPerMinute > 10) {
                    quality = 7;
                    bitDepth = 24;
                    sampleRate = 96000;
                }
            }
        }

        const fingerprint = getAudioFingerprint(filePath);
        
        const checksum = await new Promise<string>((resolve) => {
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', () => resolve(''));
        });

        const essentialMissing = missingTags.filter((tag) =>
            [
                'Title',
                'Artist',
                'Album',
                'Genre',
                'Year',
                'Cover Art',
                'Lyrics',
                'All Metadata',
                'Unreadable'
            ].includes(tag)
        );

        parentPort?.postMessage({
            filePath,
            title,
            artist,
            albumArtist: albumArtist || artistDir,
            album,
            duration: duration || 0,
            quality,
            fileSize: stats.size,
            format: ext.slice(1).toUpperCase(),
            bitDepth,
            sampleRate,
            needsUpgrade: quality < 7,
            audioFingerprint: fingerprint,
            checksum,
            missingInternalTags: essentialMissing.length > 0,
            missingTags
        });
    } catch (error) {
        parentPort?.postMessage({ filePath, error: (error as Error).message });
    }
});
