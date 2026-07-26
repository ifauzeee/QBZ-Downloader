import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { MetadataProcessor } from './MetadataProcessor.js';
import type { Metadata } from './metadata.js';

vi.mock('../config.js', () => ({
    CONFIG: {
        download: {
            folderStructure: '{artist}/{album}',
            fileNaming: '{track_number}. {title}'
        },
        quality: {
            formats: {
                27: { name: 'FLAC', extension: 'flac' },
                5: { name: 'MP3 320', extension: 'mp3' }
            }
        }
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn()
    }
}));

describe('MetadataProcessor', () => {
    let processor: MetadataProcessor;

    beforeEach(() => {
        vi.clearAllMocks();
        processor = new MetadataProcessor();
    });

    describe('sanitizeFilename', () => {
        it('should remove illegal characters', () => {
            const input = 'A/B\\C:D*E?F"G<H>I|J';
            expect(processor.sanitizeFilename(input)).toBe('ABCDEFGHIJ');
        });

        it('should replace & with and', () => {
            expect(processor.sanitizeFilename('Me & You')).toBe('Me and You');
        });

        it('should truncate long names', () => {
            const long = 'A'.repeat(200);
            expect(processor.sanitizeFilename(long, 10).length).toBe(10);
        });

        it('should return Unknown for empty input', () => {
            expect(processor.sanitizeFilename('')).toBe('Unknown');
        });
    });

    describe('applyTemplate', () => {
        const metadata = {
            artist: 'Artist',
            album: 'Album',
            title: 'Track',
            trackNumber: 5,
            year: 2024
        };

        it('should replace placeholders correctly', () => {
            const template = '{artist} - {album} - {title} - {track_number} ({year})';
            const result = processor.applyTemplate(template, metadata as unknown as Record<string, unknown>, 27);
            expect(result).toBe('Artist - Album - Track - 05 (2024)');
        });

        it('should use quality name', () => {
            const result = processor.applyTemplate('{quality}', metadata as unknown as Record<string, unknown>, 5);
            expect(result).toBe('MP3 320');
        });

        it('should handle missing metadata gracefully', () => {
            const emptyMeta = {};
            const result = processor.applyTemplate('{artist} - {title}', emptyMeta as unknown as Record<string, unknown>, 27);
            expect(result).toBe('Unknown Artist - Unknown Title');
        });
    });

    describe('multi-disc placeholders', () => {
        const disc2 = {
            artist: 'Metallica',
            albumArtist: 'Metallica',
            album: 'S&M',
            title: 'Battery',
            trackNumber: 10,
            discNumber: 2,
            totalDiscs: 2
        };

        const singleDisc = { ...disc2, discNumber: 1, totalDiscs: 1 };

        it('exposes the disc number and total', () => {
            const result = processor.applyTemplate(
                '{disc_number}-{track_number} of {total_discs}',
                disc2 as unknown as Record<string, unknown>,
                27
            );
            expect(result).toBe('2-10 of 2');
        });

        it('renders {disc_folder} as CDn on a multi-disc release', () => {
            const result = processor.applyTemplate(
                '{disc_folder}',
                disc2 as unknown as Record<string, unknown>,
                27
            );
            expect(result).toBe('CD2');
        });

        it('renders {disc_folder} empty on a single-disc release', () => {
            const result = processor.applyTemplate(
                '{disc_folder}',
                singleDisc as unknown as Record<string, unknown>,
                27
            );
            expect(result).toBe('');
        });

        it('defaults to disc 1 of 1 when the release carries no disc data', () => {
            const result = processor.applyTemplate(
                '{disc_number}/{total_discs}[{disc_folder}]',
                { title: 'T' } as unknown as Record<string, unknown>,
                27
            );
            expect(result).toBe('1/1[]');
        });

        it('splits discs into subfolders without stranding a segment on single discs', async () => {
            const { CONFIG } = await import('../config.js');
            const original = CONFIG.download.folderStructure;
            CONFIG.download.folderStructure = '{albumArtist}/{album}/{disc_folder}';

            try {
                expect(processor.buildFolderPath(disc2 as unknown as Metadata, 27))
                    .toBe(path.join('Metallica', 'SandM', 'CD2'));
                expect(processor.buildFolderPath(singleDisc as unknown as Metadata, 27))
                    .toBe(path.join('Metallica', 'SandM'));
            } finally {
                CONFIG.download.folderStructure = original;
            }
        });
    });

    describe('ensurePathSafety', () => {
        it('should return original paths if within limit', () => {
            const result = processor.ensurePathSafety('C:\\Music', 'Artist\\Album', 'Track.flac');
            expect(result).toEqual({ folder: 'Artist\\Album', file: 'Track.flac' });
        });

        it('should truncate filename if over limit', () => {
            const base = 'C:\\Very\\Long\\Path\\To\\Music\\Library\\Folder\\';
            const folder = 'Some Artist\\Some Extremely Long Album Name That Goes On And On';
            const file = '01. This Is A Very Long Track Title That Might Cause Problems On Windows Systems.flac';
            
            const result = processor.ensurePathSafety(base, folder, file);
            const totalLength = (base + result.folder + '\\' + result.file).length;
            expect(totalLength).toBeLessThanOrEqual(255);
            expect(result.file).toMatch(/\.flac$/);
        });
    });
});
