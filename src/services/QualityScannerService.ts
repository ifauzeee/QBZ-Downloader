import { Worker } from 'node:worker_threads';
import { logger } from '../utils/logger.js';

export interface QualityReport {
    isTrueLossless: boolean;
    confidence: number;
    cutoffFrequency?: number;
    details: string;
}

export class QualityScannerService {
    /**
     * Runs FFmpeg-based spectral analysis off the main event loop.
     */
    async scanFile(filePath: string): Promise<QualityReport> {
        return new Promise((resolve) => {
            let settled = false;
            const worker = new Worker(new URL('./QualityScannerWorker.js', import.meta.url), {
                workerData: { filePath }
            });

            const finish = (report: QualityReport) => {
                if (settled) return;
                settled = true;
                resolve(report);
            };

            worker.once('message', (message: QualityReport) => {
                finish(message);
            });

            worker.once('error', (error) => {
                logger.error(`QualityScanner worker failed for ${filePath}: ${error.message}`, 'SCANNER');
                finish({
                    isTrueLossless: true,
                    confidence: 0,
                    details: `Scan failed: ${error.message}`
                });
            });

            worker.once('exit', (code) => {
                if (!settled && code !== 0) {
                    logger.error(`QualityScanner worker exited with code ${code} for ${filePath}`, 'SCANNER');
                    finish({
                        isTrueLossless: true,
                        confidence: 0,
                        details: `Scan failed: worker exited with code ${code}`
                    });
                }
            });
        });
    }
}

export const qualityScannerService = new QualityScannerService();
