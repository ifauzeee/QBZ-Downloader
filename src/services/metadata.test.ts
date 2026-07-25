import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MetadataService, Metadata } from './metadata.js';

// Mock dependencies
vi.mock('node-id3', () => ({
    default: {
        write: vi.fn().mockReturnValue(true)
    }
}));

vi.mock('flac-metadata', () => ({
    default: {
        Processor: vi.fn(),
        data: {
            MetaDataBlockVorbisComment: { create: vi.fn() },
            MetaDataBlockPicture: { create: vi.fn() }
        }
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }
}));

describe('MetadataService', () => {
    let service: MetadataService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MetadataService();
    });

    describe('Utilities', () => {
        it('should normalize names', () => {
            expect(service.normalizeName('Mötley Crüe')).toBe('motley crue');
            expect(service.normalizeName('Artist - Name')).toBe('artist name');
        });

        it('should join names with and', () => {
            expect(service.joinWithAnd(['A', 'B'])).toBe('A & B');
            expect(service.joinWithAnd(['A', 'B', 'C'])).toBe('A, B & C');
        });
    });

    describe('Cover URLs', () => {
        it('should select the best cover URL', () => {
            const images = {
                small: 's.jpg',
                large: 'l.jpg',
                mega: 'm.jpg'
            };
            expect(service.selectCoverUrl(images, 'small')).toContain('s.jpg');
            expect(service.selectCoverUrl(images, 'max')).toContain('m.jpg');
        });

        it('should replace Qobuz cover sizes', () => {
            const url = 'http://qobuz.com/img/album/123_600.jpg';
            const candidates = service.getCoverUrlCandidates({ large: url }, 'max');
            expect(candidates).toContain('http://qobuz.com/img/album/123_org.jpg');
        });
    });

    describe('Extraction', () => {
        it('should extract metadata from Qobuz data', async () => {
            const track = {
                title: 'Track Title',
                track_number: 5,
                duration: 240,
                performer: { name: 'Main Artist' },
                performers: 'Main Artist, Main Artist - Featured Artist, Featuring'
            };
            const album = {
                title: 'Album Title',
                released_at: 1672531200, // 2023-01-01
                label: { name: 'Record Label' },
                genres_list: [{ name: 'Rock' }]
            };

            const metadata = await service.extractMetadata(track, album);
            expect(metadata.title).toBe('Track Title');
            expect(metadata.year).toBe(2023);
            expect(metadata.genre).toBe('Rock');
            expect(metadata.artist).toContain('Main Artist');
            expect(metadata.artist).toContain('Featured Artist');
        });

        it('should translate genres correctly', async () => {
            const track = { title: 'T' };
            const album = { genres_list: [{ name: 'Classique' }] };
            const metadata = await service.extractMetadata(track, album);
            expect(metadata.genre).toBe('Classical');
        });
    });

    describe('Tag Builders', () => {
        const mockMetadata = {
            title: 'T',
            artist: 'A',
            album: 'Alb',
            year: '2023',
            trackNumber: 1,
            totalTracks: 10,
            discNumber: 1,
            totalDiscs: 1,
            genre: 'Rock',
            label: 'L',
        } as unknown as Metadata;

        it('should build valid ID3 tags', () => {
            const tags = service.buildId3Tags(mockMetadata);
            expect(tags.title).toBe('T');
            expect(tags.trackNumber).toBe('1/10');
        });

        it('should build valid FLAC tags', () => {
            const tags = service.buildFlacTags(mockMetadata);
            const titleTag = tags.find(t => t[0] === 'TITLE');
            expect(titleTag?.[1]).toBe('T');
        });

        it('should reject when tag writing fails', async () => {
            vi.spyOn(service, 'writeFlacTags').mockRejectedValueOnce(new Error('write failed'));

            await expect(
                service.writeMetadata('track.flac', mockMetadata)
            ).rejects.toThrow('write failed');
        });
    });

    describe('escapeFFMetadataVal', () => {
        it('should escape backslashes', () => {
            const result = (service as any).escapeFFMetadataVal('a\\b');
            expect(result).toBe('a\\\\b');
        });

        it('should escape equals signs', () => {
            const result = (service as any).escapeFFMetadataVal('key=value');
            expect(result).toBe('key\\=value');
        });

        it('should escape newlines', () => {
            const result = (service as any).escapeFFMetadataVal('line1\nline2');
            expect(result).toBe('line1\\nline2');
        });

        it('should escape carriage returns', () => {
            const result = (service as any).escapeFFMetadataVal('line1\rline2');
            expect(result).toBe('line1\\rline2');
        });

        it('should escape hash at start of line', () => {
            const result = (service as any).escapeFFMetadataVal('#hashtag');
            expect(result).toBe('\\#hashtag');
        });

        it('should escape semicolon at start of line', () => {
            const result = (service as any).escapeFFMetadataVal(';comment');
            expect(result).toBe('\\;comment');
        });

        it('should not escape hash in middle of line', () => {
            const result = (service as any).escapeFFMetadataVal('a#b');
            expect(result).toBe('a#b');
        });

        it('should not escape semicolon in middle of line', () => {
            const result = (service as any).escapeFFMetadataVal('a;b');
            expect(result).toBe('a;b');
        });

        it('should handle long lyrics-like content', () => {
            const lyrics = '[00:00.00] Line one\n[00:01.00] Line two\n[00:02.00] Line three';
            const result = (service as any).escapeFFMetadataVal(lyrics);
            expect(result).toContain('[00:00.00] Line one\\n');
            expect(result).toContain('[00:01.00] Line two\\n');
            expect(result).toContain('[00:02.00] Line three');
        });

        it('should handle text with = and backslash', () => {
            const val = 'path=C:\\Music\\test';
            const result = (service as any).escapeFFMetadataVal(val);
            expect(result).toBe('path\\=C:\\\\Music\\\\test');
        });

        it('should not double-escape already valid text', () => {
            const result = (service as any).escapeFFMetadataVal('plain text');
            expect(result).toBe('plain text');
        });
    });
});
