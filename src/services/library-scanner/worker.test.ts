import { describe, expect, it } from 'vitest';
import type { IAudioMetadata } from 'music-metadata';
import {
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
