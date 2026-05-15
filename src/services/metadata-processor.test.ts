import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataProcessor } from './MetadataProcessor.js';
import { CONFIG } from '../config.js';

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
        const metadata: any = {
            artist: 'Artist',
            album: 'Album',
            title: 'Track',
            trackNumber: 5,
            year: 2024
        };

        it('should replace placeholders correctly', () => {
            const template = '{artist} - {album} - {title} - {track_number} ({year})';
            const result = processor.applyTemplate(template, metadata, 27);
            expect(result).toBe('Artist - Album - Track - 05 (2024)');
        });

        it('should use quality name', () => {
            const result = processor.applyTemplate('{quality}', metadata, 5);
            expect(result).toBe('MP3 320');
        });

        it('should handle missing metadata gracefully', () => {
            const emptyMeta: any = {};
            const result = processor.applyTemplate('{artist} - {title}', emptyMeta, 27);
            expect(result).toBe('Unknown Artist - Unknown Title');
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
