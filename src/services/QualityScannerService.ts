import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import path from 'path';
import fs from 'fs';

import { resolveBinaryPath, checkBinaryAvailability } from '../utils/binaries.js';

const execPromise = promisify(exec);

export interface QualityReport {
    isTrueLossless: boolean;
    confidence: number;
    cutoffFrequency?: number;
    details: string;
}

export class QualityScannerService {
    private static ffmpegPath: string | null = null;
    private static ffmpegAvailable: boolean | null = null;

    private async checkFFmpeg(): Promise<boolean> {
        if (QualityScannerService.ffmpegAvailable !== null) return QualityScannerService.ffmpegAvailable;
        
        const info = await checkBinaryAvailability('ffmpeg');
        QualityScannerService.ffmpegAvailable = info.available;
        QualityScannerService.ffmpegPath = info.path;

        if (!info.available) {
            logger.warn('FFmpeg not found. Quality scanning will be disabled. Please install FFmpeg or place it in the app directory.', 'SCANNER');
        } else {
            logger.debug(`FFmpeg detected at: ${info.path}`, 'SCANNER');
        }

        return info.available;
    }

    /**
     * Scans an audio file to detect if it's true lossless or upsampled.
     * Uses ffmpeg to analyze the frequency spectrum.
     */
    async scanFile(filePath: string): Promise<QualityReport> {
        try {
            const hasFFmpeg = await this.checkFFmpeg();
            if (!hasFFmpeg) {
                return {
                    isTrueLossless: true,
                    confidence: 0,
                    details: 'Quality scan skipped: FFmpeg not installed.'
                };
            }

            if (!fs.existsSync(filePath)) {
                throw new Error('File not found');
            }

            const ffmpeg = resolveBinaryPath('ffmpeg');
            const cmd16 = `"${ffmpeg}" -v error -i "${filePath}" -af "highpass=f=16000, volumedetect" -f null -`;
            const cmd20 = `"${ffmpeg}" -v error -i "${filePath}" -af "highpass=f=20000, volumedetect" -f null -`;

            const [result16, result20] = await Promise.all([
                execPromise(cmd16).catch(e => {
                    logger.debug(`FFmpeg 16k error: ${e.message}`);
                    return { stderr: e.stderr || '' };
                }),
                execPromise(cmd20).catch(e => {
                    logger.debug(`FFmpeg 20k error: ${e.message}`);
                    return { stderr: e.stderr || '' };
                })
            ]);

            const stderr16 = result16.stderr || '';
            const stderr20 = result20.stderr || '';

            const mean16 = this.parseMeanVolume(stderr16);
            const mean20 = this.parseMeanVolume(stderr20);

            // Log detailed stats for debugging
            logger.debug(`QualityScan Details: ${path.basename(filePath)} | >16kHz: ${mean16}dB | >20kHz: ${mean20}dB`);

            let isTrueLossless = true;
            let confidence = 100;
            let details = 'Crystal clear high frequencies detected.';

            // Slightly more relaxed thresholds to avoid false positives on acoustic/lo-fi tracks
            // Also check if we actually got a reading (not -100 default)
            if (mean16 !== -100 && mean16 < -80) {
                isTrueLossless = false;
                confidence = 95;
                details = 'Fake Lossless: Sharp cutoff at 16kHz detected (Likely transcoded from low-bitrate source).';
            } else if (mean20 !== -100 && mean20 < -85) {
                // Many real lossless tracks have a natural roll-off at 20kHz, so we are even more relaxed here
                isTrueLossless = false;
                confidence = 75;
                details = 'Likely Upsampled: High frequency roll-off at 20kHz detected (Common for 320kbps MP3 or older recordings).';
            }

            // If we got -100 for both, something might be wrong with the scan, but we don't want to flag it as fake
            if (mean16 === -100 && mean20 === -100) {
                return {
                    isTrueLossless: true,
                    confidence: 50,
                    details: 'Quality scan inconclusive (Frequency analysis failed or no high frequency content found).'
                };
            }

            return {
                isTrueLossless,
                confidence,
                cutoffFrequency: !isTrueLossless ? (mean16 < -80 ? 16000 : 20000) : undefined,
                details
            };

        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`QualityScanner: Failed to scan ${filePath}: ${message}`);
            return {
                isTrueLossless: true,
                confidence: 0,
                details: `Scan failed: ${message}`
            };
        }
    }

    private parseMeanVolume(output: string): number {
        const match = output.match(/mean_volume: ([-\d.]+) dB/);
        if (match) return parseFloat(match[1]);
        
        // If no match, check if there's any output at all. 
        // If ffmpeg failed, we return -100 as "no signal"
        return -100;
    }
}

export const qualityScannerService = new QualityScannerService();
