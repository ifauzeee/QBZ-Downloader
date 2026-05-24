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

const LRC_TIMESTAMP_PATTERN = /\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/;

function tagValueToText(value: unknown): string {
    if (Array.isArray(value)) return value.map(tagValueToText).join('\n');
    if (typeof value === 'object' && value !== null) {
        const maybeText = value as { text?: unknown; lyrics?: unknown; value?: unknown };
        return tagValueToText(maybeText.text ?? maybeText.lyrics ?? maybeText.value ?? '');
    }
    return String(value || '');
}

export function hasCoverArtMetadata(metadata: IAudioMetadata): boolean {
    if (metadata.common.picture?.some((picture) => picture.data?.length > 0)) return true;

    const coverTagNames = new Set(['apic', 'picture', 'metadata_block_picture', 'covr']);

    return Object.values(metadata.native || {}).some((tags) =>
        tags.some((tag) => {
            const id = tag.id.toLowerCase();
            if (!coverTagNames.has(id)) return false;
            if (Buffer.isBuffer(tag.value)) return tag.value.length > 0;
            if (Array.isArray(tag.value)) return tag.value.length > 0;
            return String(tag.value || '').trim().length > 0;
        })
    );
}

export function hasSyncedLyricsMetadata(metadata: IAudioMetadata): boolean {
    if (
        metadata.common.lyrics?.some((line: unknown) =>
            LRC_TIMESTAMP_PATTERN.test(tagValueToText(line))
        )
    ) {
        return true;
    }

    const synchronizedNativeTagNames = new Set(['sylt']);

    const timestampedLyricTagNames = new Set([
        'lyrics',
        'syncedlyrics',
        'synchronisedlyrics',
        'unsyncedlyrics',
        'unsynchronisedlyrics',
        'uslt'
    ]);

    return Object.values(metadata.native || {}).some((tags) =>
        tags.some((tag) => {
            const id = tag.id.toLowerCase();
            const text = tagValueToText(tag.value);

            if (synchronizedNativeTagNames.has(id)) return text.trim().length > 0;
            if (!timestampedLyricTagNames.has(id)) return false;

            return LRC_TIMESTAMP_PATTERN.test(text);
        })
    );
}

export function getMetadataIssueTags(missingTags: string[]): string[] {
    return missingTags.filter((tag) =>
        [
            'Title',
            'Artist',
            'Album',
            'Genre',
            'Year',
            'Cover Art',
            'Synced Lyrics',
            'All Metadata',
            'Unreadable'
        ].includes(tag)
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

                if (!hasCoverArtMetadata(metadata)) missingTags.push('Cover Art');
                if (!hasSyncedLyricsMetadata(metadata)) missingTags.push('Synced Lyrics');
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

        const essentialMissing = getMetadataIssueTags(missingTags);

        parentPort?.postMessage({
            filePath,
            title,
            artist,
            albumArtist: albumArtist || artistDir,
            album,
            duration: duration || 0,
            quality,
            fileSize: stats.size,
            fileMtimeMs: stats.mtimeMs,
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
