import crypto from 'crypto';
import { createWriteStream, createReadStream } from 'fs';
import { downloadFile } from '../utils/network.js';
import { logger } from '../utils/logger.js';
import { ThrottleStream } from '../utils/throttle.js';
import { CONFIG } from '../config.js';
import { resumeService } from './batch.js';
import { Metadata } from './metadata.js';

export interface DownloadProgress {
    phase: 'download_start' | 'download' | 'lyrics' | 'cover' | 'tagging' | 'verifying';
    loaded: number;
    total?: number;
    speed?: number;
}

export class DownloadEngine {
    async download(
        url: string,
        filePath: string,
        trackId: string,
        metadata: Metadata,
        totalLength: number,
        actualQuality: number,
        onProgress?: (progress: DownloadProgress) => void,
        isCancelled?: () => boolean
    ): Promise<{ size: number; md5: string }> {
        let downloaded = 0;
        const headers: Record<string, string> = {};
        let isResuming = false;

        if (resumeService.canResume(trackId)) {
            downloaded = resumeService.getResumePosition(trackId);
            headers['Range'] = `bytes=${downloaded}-`;
            isResuming = true;
            logger.info(`Resuming download for ${metadata.title} from ${downloaded} bytes`, 'DOWNLOAD');
        }

        const response = await downloadFile(url, { headers });
        
        const isPartial = response.status === 206;
        if (isResuming && !isPartial) {
            logger.warn('Server did not honor Range request, restarting download from scratch', 'DOWNLOAD');
            downloaded = 0;
            isResuming = false;
        }

        const startTime = Date.now();
        const md5Hash = crypto.createHash('md5');

        if (isResuming && downloaded > 0) {
            logger.info(`Re-hashing ${downloaded} bytes of existing data...`, 'DOWNLOAD');
            try {
                await new Promise<void>((resolve, reject) => {
                    const existingData = createReadStream(filePath, {
                        end: downloaded - 1,
                        highWaterMark: 1024 * 1024 // 1MB buffer for faster reading
                    });
                    existingData.on('data', (chunk) => {
                        if (isCancelled && isCancelled()) {
                            existingData.destroy();
                            reject(new Error('Cancelled by user during re-hashing'));
                            return;
                        }
                        md5Hash.update(chunk);
                    });
                    existingData.on('end', resolve);
                    existingData.on('error', reject);
                });
            } catch (hashErr: unknown) {
                const message = hashErr instanceof Error ? hashErr.message : String(hashErr);
                logger.error(`Critical failure re-hashing existing part: ${message}`, 'DOWNLOAD');
                throw new Error(`Integrity check failed: Could not re-hash existing file part for resume. ${message}`);
            }
        }

        const writer = createWriteStream(filePath, { flags: isResuming ? 'a' : 'w' });
        
        if (!isResuming) {
            resumeService.startDownload(trackId, filePath, totalLength, actualQuality);
        }

        let lastProgressEmit = 0;
        await new Promise<void>((resolve, reject) => {
            const onData = (chunk: Buffer) => {
                if (isCancelled && isCancelled()) {
                    response.data.destroy();
                    writer.destroy();
                    reject(new Error('Cancelled by user'));
                    return;
                }
                downloaded += chunk.length;
                md5Hash.update(chunk);

                if (onProgress) {
                    const currentTime = Date.now();
                    if (currentTime - lastProgressEmit >= 100 || downloaded === totalLength) {
                        const elapsed = (currentTime - startTime) / 1000;
                        const speed = elapsed > 0 ? (downloaded - (isResuming ? resumeService.getResumePosition(trackId) : 0)) / elapsed : 0;

                        onProgress({
                            phase: 'download',
                            loaded: downloaded,
                            total: totalLength,
                            speed
                        });
                        lastProgressEmit = currentTime;
                        resumeService.updateProgress(trackId, downloaded);
                    }
                }
            };

            response.data.on('data', onData);

            if (CONFIG.download.bandwidthLimit > 0) {
                const throttle = new ThrottleStream(CONFIG.download.bandwidthLimit);
                response.data.pipe(throttle).pipe(writer);
            } else {
                response.data.pipe(writer);
            }

            writer.on('finish', resolve);
            writer.on('error', reject);
            response.data.on('error', reject);
        });

        return {
            size: downloaded,
            md5: md5Hash.digest('hex')
        };
    }
}
