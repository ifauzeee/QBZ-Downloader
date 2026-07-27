import path from 'path';
import { Metadata } from './metadata.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

export class MetadataProcessor {
    sanitizeFilename(name: string, maxLength: number = 128): string {
        if (!name) return 'Unknown';
        const sanitized = name
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/&/g, 'and')
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/^\.+|\.+$/g, '');

        // Truncate while ensuring we don't end up with an empty string
        return sanitized.substring(0, maxLength).trim() || 'Unknown';
    }

    applyTemplate(template: string, metadata: Metadata, quality: number): string {
        const qualityName = CONFIG.quality.formats[quality]?.name || 'FLAC';
        let result = template;

        logger.debug(
            `Processing template: "${template}" for ${metadata.artist} - ${metadata.title}`,
            'META'
        );

        const discNumber = Number(metadata.discNumber) || 1;
        const totalDiscs = Number(metadata.totalDiscs) || 1;

        const data: Record<string, string> = {
            artist: metadata.artist || 'Unknown Artist',
            albumArtist: metadata.albumArtist || metadata.artist || 'Unknown Artist',
            album: metadata.album || 'Unknown Album',
            title: metadata.title || 'Unknown Title',
            year: metadata.year?.toString() || 'Unknown',
            quality: qualityName,
            format: qualityName,
            track_number: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            tracknumber: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            track: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            disc: discNumber.toString(),
            disc_number: discNumber.toString(),
            discnumber: discNumber.toString(),
            total_discs: totalDiscs.toString(),
            totaldiscs: totalDiscs.toString(),
            // Resolves to an empty string on single-disc releases so one folder
            // template works for both: "{albumArtist}/{album}/{disc_folder}"
            // yields "Artist/Album" for a single disc and "Artist/Album/CD2" for
            // a multi-disc set, without stranding an empty path segment.
            disc_folder: totalDiscs > 1 ? `CD${discNumber}` : ''
        };

        for (const [key, value] of Object.entries(data)) {
            // Deliberately-empty values must stay empty; sanitizeFilename maps
            // falsy input to "Unknown", which would create an "Unknown" folder.
            const sanitizedValue = value === '' ? '' : this.sanitizeFilename(String(value));
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\{${escapedKey}\\}`, 'gi');

            const newResult = result.replace(regex, sanitizedValue);
            if (newResult !== result) {
                logger.debug(`Replaced {${key}} with "${sanitizedValue}"`, 'META');
                result = newResult;
            }
        }

        return result;
    }

    buildFolderPath(metadata: Metadata, quality: number): string {
        const rendered = this.applyTemplate(CONFIG.download.folderStructure, metadata, quality);
        // A placeholder may render empty on purpose ({disc_folder} on a single-disc
        // release), which would otherwise leave an empty segment and a stray
        // separator in the path.
        return rendered.split(/[/\\]/).filter(Boolean).join(path.sep);
    }

    buildFilename(metadata: Metadata, quality: number): string {
        const format = CONFIG.quality.formats[quality] || CONFIG.quality.formats[27]!;
        const ext = format.extension || 'flac';
        const filename = this.applyTemplate(CONFIG.download.fileNaming, metadata, quality);
        return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    }

    /**
     * Ensures that the total path (base + folder + file) does not exceed Windows path limits (260 chars).
     * If it does, it intelligently truncates components while preserving extensions and essential info.
     */
    ensurePathSafety(
        basePath: string,
        folderPath: string,
        filename: string
    ): { folder: string; file: string } {
        const MAX_TOTAL_PATH = 255;
        const currentTotal = path.join(basePath, folderPath, filename).length;

        if (currentTotal <= MAX_TOTAL_PATH) {
            return { folder: folderPath, file: filename };
        }

        let overLimit = currentTotal - MAX_TOTAL_PATH;
        let newFilename = filename;

        // 1. Try truncating the filename first (but keep extension)
        const ext = path.extname(filename);
        const nameOnly = path.basename(filename, ext);

        if (nameOnly.length > 20) {
            const toCut = Math.min(overLimit, nameOnly.length - 10);
            newFilename = nameOnly.substring(0, nameOnly.length - toCut).trim() + ext;
            overLimit -= toCut;
        }

        let newFolder = folderPath;
        // 2. If still over, truncate folder components (prioritizing the deepest folder, usually album)
        if (overLimit > 0) {
            const parts = folderPath.split(/[/\\]/);
            for (let i = parts.length - 1; i >= 0 && overLimit > 0; i--) {
                const part = parts[i]!;
                if (part.length > 10) {
                    const toCut = Math.min(overLimit, part.length - 5);
                    parts[i] = part.substring(0, part.length - toCut).trim();
                    overLimit -= toCut;
                }
            }
            newFolder = parts.join(path.sep);
        }

        logger.warn(`Path too long (${currentTotal} chars). Truncated to fit limit.`, 'PROCESSOR');
        return { folder: newFolder, file: newFilename };
    }
}
