import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class FormatConverterService {
    async convert(inputPath: string, metadata: any): Promise<string | null> {
        const { enabled, format, bitrate, outputDir, keepOriginal } = CONFIG.export;

        if (!enabled || !inputPath.endsWith('.flac')) {
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
                } catch (e: any) {
                    logger.warn(`Converter: Failed to remove original file: ${e.message}`, 'CONVERTER');
                }
            }

            return outputPath;
        } catch (error: any) {
            logger.error(`Converter: Conversion failed: ${error.message}`, 'CONVERTER');
            return null;
        }
    }
}

export const formatConverterService = new FormatConverterService();
