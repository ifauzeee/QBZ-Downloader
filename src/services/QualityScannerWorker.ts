import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';
import { promisify } from 'node:util';
import { checkBinaryAvailability, resolveBinaryPath } from '../utils/binaries.js';
import { logger } from '../utils/logger.js';
import type { QualityReport } from './QualityScannerService.js';

const execPromise = promisify(exec);

export function parseMeanVolume(output: string): number {
    const match = output.match(/mean_volume: ([-\d.]+) dB/);
    if (match) return parseFloat(match[1]);

    return -100;
}

export async function scanQualityFile(filePath: string): Promise<QualityReport> {
    try {
        const info = await checkBinaryAvailability('ffmpeg');
        if (!info.available) {
            logger.warn(
                'FFmpeg not found. Quality scanning will be disabled. Please install FFmpeg or place it in the app directory.',
                'SCANNER'
            );
            return {
                isTrueLossless: true,
                confidence: 0,
                details: 'Quality scan skipped: FFmpeg not installed.'
            };
        }

        logger.debug(`FFmpeg detected at: ${info.path}`, 'SCANNER');

        if (!fs.existsSync(filePath)) {
            throw new Error('File not found');
        }

        const ffmpeg = resolveBinaryPath('ffmpeg');
        const cmd16 = `"${ffmpeg}" -v error -i "${filePath}" -af "highpass=f=16000, volumedetect" -f null -`;
        const cmd20 = `"${ffmpeg}" -v error -i "${filePath}" -af "highpass=f=20000, volumedetect" -f null -`;

        const [result16, result20] = await Promise.all([
            execPromise(cmd16).catch((error) => {
                logger.debug(`FFmpeg 16k error: ${error.message}`);
                return { stderr: error.stderr || '' };
            }),
            execPromise(cmd20).catch((error) => {
                logger.debug(`FFmpeg 20k error: ${error.message}`);
                return { stderr: error.stderr || '' };
            })
        ]);

        const mean16 = parseMeanVolume(result16.stderr || '');
        const mean20 = parseMeanVolume(result20.stderr || '');

        logger.debug(
            `QualityScan Details: ${path.basename(filePath)} | >16kHz: ${mean16}dB | >20kHz: ${mean20}dB`,
            'SCANNER'
        );

        let isTrueLossless = true;
        let confidence = 100;
        let details = 'Crystal clear high frequencies detected.';

        if (mean16 !== -100 && mean16 < -80) {
            isTrueLossless = false;
            confidence = 95;
            details =
                'Fake Lossless: Sharp cutoff at 16kHz detected (Likely transcoded from low-bitrate source).';
        } else if (mean20 !== -100 && mean20 < -85) {
            isTrueLossless = false;
            confidence = 75;
            details =
                'Likely Upsampled: High frequency roll-off at 20kHz detected (Common for 320kbps MP3 or older recordings).';
        }

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
        logger.error(`QualityScanner: Failed to scan ${filePath}: ${message}`, 'SCANNER');
        return {
            isTrueLossless: true,
            confidence: 0,
            details: `Scan failed: ${message}`
        };
    }
}

const port = parentPort;

if (port) {
    const { filePath } = workerData as { filePath: string };
    scanQualityFile(filePath)
        .then((report) => port.postMessage(report))
        .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            port.postMessage({
                isTrueLossless: true,
                confidence: 0,
                details: `Scan failed: ${message}`
            } satisfies QualityReport);
        });
}
