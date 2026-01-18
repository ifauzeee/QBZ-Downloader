import { parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function readFlacMetadata(
    filePath: string
): { bitDepth: number; sampleRate: number; duration: number } | null {
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(4);

        fs.readSync(fd, header, 0, 4, 0);
        if (header.toString('ascii') !== 'fLaC') {
            fs.closeSync(fd);
            return null;
        }

        let offset = 4;
        let isLast = false;
        const blockHeader = Buffer.alloc(4);

        while (!isLast) {
            const bytesRead = fs.readSync(fd, blockHeader, 0, 4, offset);
            if (bytesRead < 4) break;

            const isLastBit = (blockHeader[0] >> 7) & 1;
            const type = blockHeader[0] & 0x7f;
            const length = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];

            isLast = isLastBit === 1;
            offset += 4;

            if (type === 0) {
                const buffer = Buffer.alloc(34);
                fs.readSync(fd, buffer, 0, 34, offset);

                const sampleRate =
                    (buffer[10] << 12) | (buffer[11] << 4) | ((buffer[12] & 0xf0) >> 4);
                const bitsPerSampleMinus1 = ((buffer[12] & 0x01) << 4) | ((buffer[13] & 0xf0) >> 4);
                const bitDepth = bitsPerSampleMinus1 + 1;

                const totalSamplesHi = buffer[13] & 0x0f;
                const totalSamplesLo =
                    (buffer[14] << 24) | (buffer[15] << 16) | (buffer[16] << 8) | buffer[17];
                const totalSamples = totalSamplesHi * 4294967296 + (totalSamplesLo >>> 0);

                const duration = sampleRate > 0 ? totalSamples / sampleRate : 0;

                fs.closeSync(fd);
                return { bitDepth, sampleRate, duration };
            }

            offset += length;
        }

        fs.closeSync(fd);
        return null;
    } catch {
        if (fd) {
            try {
                fs.closeSync(fd);
            } catch {}
        }
        return null;
    }
}

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

parentPort?.on('message', (filePath: string) => {
    try {
        const stats = fs.statSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const filename = path.basename(filePath, ext);
        const parentDir = path.basename(path.dirname(filePath));
        const artistDir = path.basename(path.dirname(path.dirname(filePath)));

        let title = filename;
        let artist = artistDir || 'Unknown';
        const album = parentDir || 'Unknown';

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

        let quality = 6;
        let bitDepth = 16;
        let sampleRate = 44100;
        let duration = 0;

        if (ext === '.mp3') {
            quality = 5;
            bitDepth = 0;
            sampleRate = 0;
        } else if (ext === '.flac') {
            const flacMeta = readFlacMetadata(filePath);
            if (flacMeta) {
                bitDepth = flacMeta.bitDepth;
                sampleRate = flacMeta.sampleRate;
                duration = flacMeta.duration;
                if (bitDepth >= 24 && sampleRate >= 176400) quality = 27;
                else if (bitDepth >= 24) quality = 7;
                else quality = 6;
            } else {
                const mbPerMinute = stats.size / (1024 * 1024) / 4;
                if (mbPerMinute > 20) {
                    quality = 27;
                    bitDepth = 24;
                    sampleRate = 192000;
                } else if (mbPerMinute > 10) {
                    quality = 7;
                    bitDepth = 24;
                    sampleRate = 96000;
                } else {
                    quality = 6;
                    bitDepth = 16;
                    sampleRate = 44100;
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
            audioFingerprint: fingerprint
        });
    } catch (error) {
        parentPort?.postMessage({ filePath, error: (error as Error).message });
    }
});
