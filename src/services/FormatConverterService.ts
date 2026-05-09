import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

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

        const baseName = path.basename(inputPath, '.flac');
        const dirName = path.dirname(inputPath);
        const finalOutputDir = outputDir || dirName;

        if (!existsSync(finalOutputDir)) {
            mkdirSync(finalOutputDir, { recursive: true });
        }

        const outputPath = path.join(finalOutputDir, `${baseName}.${format}`);
        
        if (existsSync(outputPath)) {
            logger.debug(`Converter: Output file already exists, skipping: ${outputPath}`, 'CONVERTER');
            return outputPath;
        }

        logger.info(`Converter: Exporting ${baseName} to ${format.toUpperCase()} (${bitrate})...`, 'CONVERTER');

        try {
            let codec = 'libmp3lame';
            if (format === 'aac') codec = 'aac';
            if (format === 'opus') codec = 'libopus';

            const cmd = `ffmpeg -i "${inputPath}" -codec:a ${codec} -b:a ${bitrate} -map_metadata 0 "${outputPath}"`;
            await execAsync(cmd);

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
        try {
            await execAsync('ffmpeg -version');
            return true;
        } catch {
            return false;
        }
    }
}

export const formatConverterService = new FormatConverterService();
