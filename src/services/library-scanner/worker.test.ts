import { describe, expect, it } from 'vitest';
import type { IAudioMetadata } from 'music-metadata';
import {
    deriveQuality,
    getMetadataIssueTags,
    hasCoverArtMetadata,
    hasSyncedLyricsMetadata
} from './worker.js';

describe('library scanner worker metadata issue tags', () => {
    it('treats cover art and synced lyrics as metadata issues', () => {
        expect(getMetadataIssueTags(['Cover Art', 'Synced Lyrics'])).toEqual([
            'Cover Art',
            'Synced Lyrics'
        ]);
    });

    it('keeps core missing tags as metadata issues', () => {
        expect(getMetadataIssueTags(['Cover Art', 'Genre', 'Synced Lyrics', 'Year'])).toEqual([
            'Cover Art',
            'Genre',
            'Synced Lyrics',
            'Year'
        ]);
    });
});

describe('library scanner worker cover art detection', () => {
    it('detects embedded cover art from common pictures', () => {
        const metadata = {
            common: { picture: [{ data: Buffer.from('cover') }] },
            native: {}
        } as IAudioMetadata;

        expect(hasCoverArtMetadata(metadata)).toBe(true);
    });

    it('detects missing cover art', () => {
        const metadata = {
            common: {},
            native: {}
        } as IAudioMetadata;

        expect(hasCoverArtMetadata(metadata)).toBe(false);
    });
});

describe('library scanner worker quality derivation', () => {
    it('rates 24-bit/192kHz lossless as quality 27', () => {
        const { quality, bitDepth, sampleRate } = deriveQuality(
            { lossless: true, bitsPerSample: 24, sampleRate: 192000 },
            '.flac'
        );
        expect({ quality, bitDepth, sampleRate }).toEqual({
            quality: 27,
            bitDepth: 24,
            sampleRate: 192000
        });
    });

    it('rates 24-bit/96kHz lossless as quality 7', () => {
        const { quality } = deriveQuality(
            { lossless: true, bitsPerSample: 24, sampleRate: 96000 },
            '.flac'
        );
        expect(quality).toBe(7);
    });

    it('rates a WAV with WAVE_FORMAT_EXTENSIBLE (lossless) high-res as quality 7', () => {
        // music-metadata >=12.4 now reports WAVE_FORMAT_EXTENSIBLE as lossless,
        // so a 24-bit WAV must not degrade to quality 5.
        const { quality } = deriveQuality(
            { lossless: true, bitsPerSample: 24, sampleRate: 96000 },
            '.wav'
        );
        expect(quality).toBe(7);
    });

    it('rates a lossy 320kbps file as quality 5', () => {
        const { quality } = deriveQuality({ lossless: false, bitrate: 320000 }, '.mp3');
        expect(quality).toBe(5);
    });

    it('defaults unreadable/lossy low-bitrate to quality 5', () => {
        const { quality } = deriveQuality({ lossless: false, bitrate: 128000 }, '.mp3');
        expect(quality).toBe(5);
    });
});

describe('library scanner worker synced lyrics detection', () => {
    it('rejects plain lyrics without timestamps', () => {
        const metadata = {
            common: { lyrics: ['This is just plain lyrics'] },
            native: {}
        } as IAudioMetadata;

        expect(hasSyncedLyricsMetadata(metadata)).toBe(false);
    });

    it('accepts timestamped LRC lyrics', () => {
        const metadata = {
            common: { lyrics: ['[00:12.34]Timed lyric line'] },
            native: {}
        } as IAudioMetadata;

        expect(hasSyncedLyricsMetadata(metadata)).toBe(true);
    });

    it('rejects native synced lyrics tags when the text has no timestamps', () => {
        const metadata = {
            common: {},
            native: {
                vorbis: [{ id: 'SYNCHRONISEDLYRICS', value: 'Plain lyric line' }]
            }
        } as unknown as IAudioMetadata;

        expect(hasSyncedLyricsMetadata(metadata)).toBe(false);
    });
});
