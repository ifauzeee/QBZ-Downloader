import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

const execPromise = promisify(exec);

export interface QualityReport {
    isTrueLossless: boolean;
    confidence: number;
    cutoffFrequency?: number;
    details: string;
}

export class QualityScannerService {
    /**
     * Scans an audio file to detect if it's true lossless or upsampled.
     * Uses ffmpeg to analyze the frequency spectrum.
     */
    async scanFile(filePath: string): Promise<QualityReport> {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('File not found');
            }

            const cmd16 = `ffmpeg -i "${filePath}" -af "highpass=f=16000, volumedetect" -f null -`;
            const cmd20 = `ffmpeg -i "${filePath}" -af "highpass=f=20000, volumedetect" -f null -`;

            const [result16, result20] = await Promise.all([
                execPromise(cmd16).catch(e => e),
                execPromise(cmd20).catch(e => e)
            ]);

            const mean16 = this.parseMeanVolume(result16.stderr || '');
            const mean20 = this.parseMeanVolume(result20.stderr || '');

            logger.debug(`QualityScan: ${path.basename(filePath)} | Mean >16kHz: ${mean16}dB | Mean >20kHz: ${mean20}dB`);

            let isTrueLossless = true;
            let confidence = 100;
            let details = 'Crystal clear high frequencies detected.';

            if (mean16 < -75) {
                isTrueLossless = false;
                confidence = 95;
                details = 'Fake Lossless: Sharp cutoff at 16kHz detected (Common for 128kbps MP3).';
            } else if (mean20 < -80) {
                isTrueLossless = false;
                confidence = 80;
                details = 'Likely Upsampled: High frequency roll-off at 20kHz detected (Common for 320kbps MP3).';
            }

            return {
                isTrueLossless,
                confidence,
                cutoffFrequency: mean20 < -80 ? (mean16 < -75 ? 16000 : 20000) : undefined,
                details
            };

        } catch (error: any) {
            logger.error(`QualityScanner: Failed to scan ${filePath}: ${error.message}`);
            return {
                isTrueLossless: true,
                confidence: 0,
                details: `Scan failed: ${error.message}`
            };
        }
    }

    private parseMeanVolume(output: string): number {
        const match = output.match(/mean_volume: ([\-\d\.]+) dB/);
        return match ? parseFloat(match[1]) : -100;
    }
}

export const qualityScannerService = new QualityScannerService();
