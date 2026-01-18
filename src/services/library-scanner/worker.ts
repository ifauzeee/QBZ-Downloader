import { parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { parseFile } from 'music-metadata';

function getAudioFingerprint(filePath: string): string | undefined {
    try {
        const stdout = execSync(`fpcalc -json "${filePath}"`, {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        const data = JSON.parse(stdout);
        return data.fingerprint;
    } catch {
        return undefined;
    }
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
        let album = parentDir || 'Unknown';
        let quality = 6;
        let bitDepth = 16;
        let sampleRate = 44100;
        let duration = 0;
        let trackNo = 0;
        let missingInternalTags = true;

        const patterns = [/^(.+?)\s*-\s*(.+)$/, /^\d+\.\s*(.+)$/, /^\d+\s*-\s*(.+)$/];
        for (const pattern of patterns) {
            const match = filename.match(pattern);
            if (match) {
                if (match.length === 3) {
                    artist = match[1].trim();
                    title = match[2].trim();
                } else {
                    title = match[1].trim();
                }
                break;
            }
        }

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

                const hasBasicTags =
                    metadata.common.title && metadata.common.artist && metadata.common.album;
                const hasPicture = metadata.common.picture && metadata.common.picture.length > 0;
                const hasLyrics = metadata.common.lyrics && metadata.common.lyrics.length > 0;

                const hasGenre = metadata.common.genre && metadata.common.genre.length > 0;
                const hasDate = metadata.common.year || metadata.common.date;
                const hasComposer = metadata.common.composer && metadata.common.composer.length > 0;

                if (hasBasicTags && hasPicture && hasLyrics && hasGenre && hasDate && hasComposer) {
                    missingInternalTags = false;
                }
                if (metadata.common.artist) artist = metadata.common.artist;
                if (metadata.common.album) album = metadata.common.album;
                if (metadata.common.track && metadata.common.track.no)
                    trackNo = metadata.common.track.no;
            }
        } catch (err) {
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

        parentPort?.postMessage({
            filePath,
            title,
            artist,
            album,
            duration: duration || 0,
            quality,
            fileSize: stats.size,
            format: ext.slice(1).toUpperCase(),
            bitDepth,
            sampleRate,
            needsUpgrade: quality < 7,
            audioFingerprint: fingerprint,
            missingInternalTags: missingInternalTags
        });
    } catch (error) {
        parentPort?.postMessage({ filePath, error: (error as Error).message });
    }
});
