import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

import { resolveBinaryPath, checkBinaryAvailability } from '../utils/binaries.js';

const execFileAsync = promisify(execFile);

/**
 * EXPORT_FORMAT and EXPORT_BITRATE are free-form strings written through the
 * settings API. They end up as ffmpeg arguments and as an output file
 * extension, so both are constrained to a known set rather than trusted.
 */
const CODECS: Record<string, string> = {
    mp3: 'libmp3lame',
    aac: 'aac',
    opus: 'libopus'
};
const DEFAULT_FORMAT = 'mp3';
const ALLOWED_BITRATES = new Set(['96k', '128k', '160k', '192k', '256k', '320k']);
const DEFAULT_BITRATE = '320k';

export class FormatConverterService {
    async convert(inputPath: string): Promise<string | null> {
        const { enabled, format, bitrate, outputDir, keepOriginal } = CONFIG.export;

        if (!enabled || !inputPath.endsWith('.flac')) {
            return null;
        }

        if (!(await this.isAvailable())) {
            logger.error(
                'Converter: ffmpeg is not installed or not in PATH. Conversion disabled.',
                'CONVERTER'
            );
            return null;
        }

        const safeFormat = Object.prototype.hasOwnProperty.call(CODECS, format)
            ? format
            : DEFAULT_FORMAT;
        const safeBitrate = ALLOWED_BITRATES.has(bitrate) ? bitrate : DEFAULT_BITRATE;

        if (safeFormat !== format) {
            logger.warn(
                `Converter: unsupported EXPORT_FORMAT "${format}", falling back to ${DEFAULT_FORMAT}`,
                'CONVERTER'
            );
        }
        if (safeBitrate !== bitrate) {
            logger.warn(
                `Converter: unsupported EXPORT_BITRATE "${bitrate}", falling back to ${DEFAULT_BITRATE}`,
                'CONVERTER'
            );
        }

        const baseName = path.basename(inputPath, '.flac');
        const dirName = path.dirname(inputPath);
        const finalOutputDir = outputDir || dirName;

        if (!existsSync(finalOutputDir)) {
            mkdirSync(finalOutputDir, { recursive: true });
        }

        const outputPath = path.join(finalOutputDir, `${baseName}.${safeFormat}`);
        
        if (existsSync(outputPath)) {
            logger.debug(`Converter: Output file already exists, skipping: ${outputPath}`, 'CONVERTER');
            return outputPath;
        }

        logger.info(
            `Converter: Exporting ${baseName} to ${safeFormat.toUpperCase()} (${safeBitrate})...`,
            'CONVERTER'
        );

        try {
            const codec = CODECS[safeFormat]!;

            const ffmpeg = resolveBinaryPath('ffmpeg');
            // argv form, never a shell string: bitrate was interpolated
            // unquoted, so a settings write was enough to append a command.
            await execFileAsync(ffmpeg, [
                '-i',
                inputPath,
                '-codec:a',
                codec,
                '-b:a',
                safeBitrate,
                '-map_metadata',
                '0',
                outputPath
            ]);

            logger.success(`Converter: Export complete: ${path.basename(outputPath)}`, 'CONVERTER');

            if (!keepOriginal) {
                try {
                    unlinkSync(inputPath);
                    logger.debug(`Converter: Original file removed: ${path.basename(inputPath)}`, 'CONVERTER');
                } catch (e: unknown) {
                    const message = e instanceof Error ? e.message : String(e);
                    logger.warn(`Converter: Failed to remove original file: ${message}`, 'CONVERTER');
                }
            }

            return outputPath;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Converter: Conversion failed: ${message}`, 'CONVERTER');
            return null;
        }
    }

    async isAvailable(): Promise<boolean> {
        const info = await checkBinaryAvailability('ffmpeg');
        return info.available;
    }
}

export const formatConverterService = new FormatConverterService();
