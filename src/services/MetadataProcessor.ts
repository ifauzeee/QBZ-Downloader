import { Metadata } from './metadata.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

export class MetadataProcessor {
    sanitizeFilename(name: string): string {
        if (!name) return 'Unknown';
        return (
            name
                .replace(/[<>:"/\\|?*]/g, '')
                .replace(/&/g, 'and')
                .replace(/\s+/g, ' ')
                .trim()
                .replace(/^\.+|\.+$/g, '')
                .substring(0, 128) || 'Unknown'
        );
    }

    applyTemplate(template: string, metadata: Metadata, quality: number): string {
        const qualityName = CONFIG.quality.formats[quality]?.name || 'FLAC';
        let result = template;

        logger.info(
            `Processing template: "${template}" for ${metadata.artist} - ${metadata.title}`,
            'DEBUG'
        );

        const data: Record<string, any> = {
            artist: metadata.artist || 'Unknown Artist',
            albumArtist: metadata.albumArtist || metadata.artist || 'Unknown Artist',
            album: metadata.album || 'Unknown Album',
            title: metadata.title || 'Unknown Title',
            year: metadata.year?.toString() || 'Unknown',
            quality: qualityName,
            format: qualityName,
            track_number: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            tracknumber: metadata.trackNumber?.toString().padStart(2, '0') || '01',
            track: metadata.trackNumber?.toString().padStart(2, '0') || '01'
        };

        for (const [key, value] of Object.entries(data)) {
            const sanitizedValue = this.sanitizeFilename(String(value));
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\{${escapedKey}\\}`, 'gi');

            if (regex.test(result)) {
                result = result.replace(regex, sanitizedValue);
                logger.debug(`Replaced {${key}} with "${sanitizedValue}"`, 'DEBUG');
            }
        }

        return result;
    }

    buildFolderPath(metadata: Metadata, quality: number): string {
        return this.applyTemplate(CONFIG.download.folderStructure, metadata, quality);
    }

    buildFilename(metadata: Metadata, quality: number): string {
        const format = CONFIG.quality.formats[quality] || CONFIG.quality.formats[27];
        const ext = format.extension || 'flac';
        const filename = this.applyTemplate(CONFIG.download.fileNaming, metadata, quality);
        return filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    }
}
