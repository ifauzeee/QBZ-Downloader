import { describe, it, expect, vi } from 'vitest';
import MetadataService from './metadata.js';

describe('MetadataService', () => {
    const metadataService = new MetadataService();
    (metadataService as any).fetchItunesMetadata = vi.fn().mockResolvedValue(null);

    const mockMetadata: any = {
        title: 'Test Title',
        artist: 'Test Artist',
        album: 'Test Album'
    };

    const mockLyricsSynced = {
        plainLyrics: 'Line 1\nLine 2',
        syncedLyrics: '[00:10.00] Line 1\n[00:20.00] Line 2',
        syltFormat: [
            { text: 'Line 1', timeStamp: 10000 },
            { text: 'Line 2', timeStamp: 20000 }
        ],
        source: 'LRCLIB'
    };

    const mockLyricsPlainOnly = {
        plainLyrics: 'Line 1\nLine 2',
        syncedLyrics: null,
        syltFormat: null,
        source: 'Genius'
    };

    describe('buildId3Tags', () => {
        it('should include synced lyrics when available', () => {
            const tags = metadataService.buildId3Tags(mockMetadata, null, mockLyricsSynced);
            expect(tags.synchronisedLyrics).toBeDefined();
            expect(tags.unsynchronisedLyrics).toBeDefined();
            expect(tags.unsynchronisedLyrics.text).toBe(mockLyricsSynced.syncedLyrics);
        });

        it('should not include lyrics when none available', () => {
            const tags = metadataService.buildId3Tags(mockMetadata, null, mockLyricsPlainOnly);
            expect(tags.synchronisedLyrics).toBeUndefined();
            expect(tags.unsynchronisedLyrics).toBeUndefined();
        });
    });

    describe('buildFlacTags', () => {
        it('should include synced lyrics when available', () => {
            const tags = metadataService.buildFlacTags(mockMetadata, mockLyricsSynced);
            const tagObj = Object.fromEntries(tags);

            expect(tagObj['SYNCEDLYRICS']).toBeDefined();
            expect(tagObj['LYRICS']).toBe(mockLyricsSynced.syncedLyrics);
        });

        it('should not include lyrics tags when none available', () => {
            const tags = metadataService.buildFlacTags(mockMetadata, mockLyricsPlainOnly);
            const tagObj = Object.fromEntries(tags);

            expect(tagObj['SYNCEDLYRICS']).toBeUndefined();
            expect(tagObj['LYRICS']).toBeUndefined();
        });
    });

    describe('Artist Extraction', () => {
        it('should extract featured artists correctly', async () => {
            const track = {
                title: 'Starboy',
                performer: { name: 'The Weeknd' },
                performers: 'The Weeknd, Main Artist - Daft Punk, Featured Artist',
                album: { title: 'Starboy' }
            };

            const metadata = await metadataService.extractMetadata(track, {});
            expect(metadata.performers.featured).toContain('Daft Punk');
            expect(metadata.artist).toContain('Daft Punk');
        });

        it('should extract multiple main artists', async () => {
            const track = {
                title: 'Die With A Smile',
                performer: { name: 'Lady Gaga' },
                performers: 'Lady Gaga, Main Artist - Bruno Mars, Main Artist',
                album: { title: 'Die With A Smile' }
            };

            const metadata = await metadataService.extractMetadata(track, {});
            expect(metadata.artist).toContain('Lady Gaga');
            expect(metadata.artist).toContain('Bruno Mars');
        });
    });
});
