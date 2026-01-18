import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { downloadQueue } from './queue/queue.js';
import { inputValidator } from '../utils/validator.js';
import { notifyBatchZipCreated } from './notifications.js';

interface PartialDownload {
    trackId: string;
    filePath: string;
    bytesDownloaded: number;
    totalBytes: number;
    quality: number;
    startedAt: string;
}

interface ResumeData {
    version: number;
    downloads: Record<string, PartialDownload>;
}

const RESUME_VERSION = 1;
const DEFAULT_RESUME_PATH = './data/resume.json';

export class ResumeService {
    private partials: Map<string, PartialDownload> = new Map();
    private filePath: string;

    constructor(resumePath?: string) {
        this.filePath = resumePath || DEFAULT_RESUME_PATH;
        this.load();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf8');
                const data: ResumeData = JSON.parse(content);

                if (data.version === RESUME_VERSION && data.downloads) {
                    for (const [id, partial] of Object.entries(data.downloads)) {
                        this.partials.set(id, partial);
                    }
                    logger.debug(`Resume: Loaded ${this.partials.size} partial downloads`);
                }
            }
        } catch (error: any) {
            logger.warn(`Resume: Failed to load (${error.message})`);
        }
    }

    private save(): void {
        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data: ResumeData = {
                version: RESUME_VERSION,
                downloads: Object.fromEntries(this.partials)
            };

            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
        } catch (error: any) {
            logger.error(`Resume: Failed to save (${error.message})`);
        }
    }

    startDownload(trackId: string, filePath: string, totalBytes: number, quality: number): void {
        this.partials.set(trackId, {
            trackId,
            filePath,
            bytesDownloaded: 0,
            totalBytes,
            quality,
            startedAt: new Date().toISOString()
        });
        this.save();
    }

    updateProgress(trackId: string, bytesDownloaded: number): void {
        const partial = this.partials.get(trackId);
        if (partial) {
            partial.bytesDownloaded = bytesDownloaded;
            this.save();
        }
    }

    completeDownload(trackId: string): void {
        this.partials.delete(trackId);
        this.save();
    }

    getPartial(trackId: string): PartialDownload | undefined {
        return this.partials.get(trackId);
    }

    canResume(trackId: string): boolean {
        const partial = this.partials.get(trackId);
        if (!partial) return false;

        if (!fs.existsSync(partial.filePath)) {
            this.partials.delete(trackId);
            this.save();
            return false;
        }

        const stats = fs.statSync(partial.filePath);
        return stats.size > 0 && stats.size < partial.totalBytes;
    }

    getResumePosition(trackId: string): number {
        const partial = this.partials.get(trackId);
        if (!partial) return 0;

        if (fs.existsSync(partial.filePath)) {
            const stats = fs.statSync(partial.filePath);
            return stats.size;
        }

        return 0;
    }

    getResumable(): PartialDownload[] {
        const resumable: PartialDownload[] = [];
        for (const [id, partial] of this.partials) {
            if (this.canResume(id)) {
                resumable.push(partial);
            }
        }
        return resumable;
    }

    clearAll(): void {
        this.partials.clear();
        this.save();
    }
}

export const resumeService = new ResumeService();

interface BatchStatus {
    id: string;
    total: number;
    completed: number;
    failed: number;
    files: string[];
    createdAt: number;
}

export class BatchImportService {
    private activeBatches: Map<string, BatchStatus> = new Map();

    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        downloadQueue.on('item:completed', (item: any) => {
            if (item.metadata && item.metadata.batchId) {
                if (item.metadata.batchFiles && Array.isArray(item.metadata.batchFiles)) {
                    this.updateBatchProgress(
                        item.metadata.batchId,
                        'completed',
                        undefined,
                        item.metadata.batchFiles
                    );
                } else {
                    this.updateBatchProgress(item.metadata.batchId, 'completed', item.filePath);
                }
            }
        });

        downloadQueue.on('item:failed', (item: any) => {
            if (item.metadata && item.metadata.batchId) {
                this.updateBatchProgress(item.metadata.batchId, 'failed');
            }
        });
    }

    private updateBatchProgress(
        batchId: string,
        status: 'completed' | 'failed',
        filePath?: string,
        batchFiles?: string[]
    ) {
        const batch = this.activeBatches.get(batchId);
        if (!batch) return;

        if (status === 'completed') {
            batch.completed++;
            if (filePath) batch.files.push(filePath);
            if (batchFiles) batch.files.push(...batchFiles);
        } else {
            batch.failed++;
        }

        logger.debug(
            `Batch ${batchId} progress: ${batch.completed + batch.failed}/${batch.total}`,
            'BATCH'
        );

        if (batch.completed + batch.failed >= batch.total) {
            this.finalizeBatch(batchId);
        }
    }

    private async finalizeBatch(batchId: string) {
        const batch = this.activeBatches.get(batchId);
        if (!batch) return;

        if (batch.files.length > 0) {
            logger.info(
                `Batch ${batchId} finished. Creating ZIP archive for ${batch.files.length} files...`,
                'BATCH'
            );
            await this.createZipArchive(batch);
        } else {
            logger.warn(
                `Batch ${batchId} finished but no files were downloaded successfully.`,
                'BATCH'
            );
        }

        this.activeBatches.delete(batchId);
    }

    private async createZipArchive(batch: BatchStatus) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const zipName = `Batch_Download_${timestamp}.zip`;
            const zipPath = path.join(CONFIG.download.outputDir || './downloads', zipName);

            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                logger.info(
                    `Batch ZIP created: ${zipName} (${archive.pointer()} total bytes)`,
                    'BATCH'
                );
                notifyBatchZipCreated(zipName, zipPath);
            });

            archive.on('error', (err: any) => {
                logger.error(`Error creating batch ZIP: ${err.message}`, 'BATCH');
            });

            archive.pipe(output);

            for (const file of batch.files) {
                if (fs.existsSync(file)) {
                    const downloadDir = path.resolve(CONFIG.download.outputDir || './downloads');
                    const headers = path.relative(downloadDir, file);
                    archive.file(file, { name: headers });
                }
            }

            await archive.finalize();
        } catch (error: any) {
            logger.error(`Failed to create ZIP: ${error.message}`, 'BATCH');
        }
    }

    async importFromFile(
        filePath: string,
        quality: number = 27
    ): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: string[];
    }> {
        if (!fs.existsSync(filePath)) {
            return { success: false, imported: 0, failed: 0, errors: ['File not found'] };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'));

        return this.importUrls(lines, quality);
    }

    async importFromM3u8(
        filePath: string,
        quality: number = 27
    ): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: string[];
    }> {
        if (!fs.existsSync(filePath)) {
            return { success: false, imported: 0, failed: 0, errors: ['File not found'] };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const urls: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                if (trimmed.startsWith('http') || trimmed.includes('qobuz.com')) {
                    urls.push(trimmed);
                }
            }
        }

        return this.importUrls(urls, quality);
    }

    async importFromCsv(
        filePath: string,
        defaultQuality: number = 27
    ): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: string[];
    }> {
        if (!fs.existsSync(filePath)) {
            return { success: false, imported: 0, failed: 0, errors: ['File not found'] };
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l);

        if (lines.length < 2) {
            return {
                success: false,
                imported: 0,
                failed: 0,
                errors: ['CSV file is empty or has no data rows']
            };
        }

        const headers = lines[0]
            .toLowerCase()
            .split(',')
            .map((h) => h.trim());
        const urlIndex = headers.findIndex((h) => h === 'url' || h === 'link');
        const qualityIndex = headers.findIndex((h) => h === 'quality' || h === 'format');

        if (urlIndex === -1) {
            return {
                success: false,
                imported: 0,
                failed: 0,
                errors: ['CSV must have a "url" column']
            };
        }

        const urlsWithQuality: { url: string; quality: number }[] = [];

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map((c) => c.trim());
            const url = cols[urlIndex];
            const quality =
                qualityIndex !== -1
                    ? parseInt(cols[qualityIndex]) || defaultQuality
                    : defaultQuality;

            if (url) {
                urlsWithQuality.push({ url, quality });
            }
        }

        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const { url, quality } of urlsWithQuality) {
            try {
                await this.addToQueue(url, quality);
                imported++;
            } catch (error: any) {
                failed++;
                errors.push(`${url}: ${error.message}`);
            }
        }

        return { success: failed === 0, imported, failed, errors };
    }

    async importUrls(
        urls: string[],
        quality: number = 27,
        createZip: boolean = false
    ): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: string[];
    }> {
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];
        const batchId = createZip ? crypto.randomUUID() : undefined;

        if (batchId) {
            this.activeBatches.set(batchId, {
                id: batchId,
                total: urls.length,
                completed: 0,
                failed: 0,
                files: [],
                createdAt: Date.now()
            });
        }

        for (const url of urls) {
            try {
                await this.addToQueue(url, quality, batchId);
                imported++;
            } catch (error: any) {
                failed++;
                errors.push(`${url}: ${error.message}`);
                if (batchId) {
                    this.updateBatchProgress(batchId, 'failed');
                }
            }
        }

        return { success: failed === 0, imported, failed, errors };
    }

    private async addToQueue(url: string, quality: number, batchId?: string): Promise<void> {
        const validation = inputValidator.validateUrl(url);

        if (!validation.valid) {
            throw new Error(validation.error || 'Invalid URL');
        }

        if (validation.type && validation.id) {
            const type = validation.type as any;
            downloadQueue.add(type, validation.id, quality, {
                title: `${type}: ${validation.id}`,
                metadata: { source: 'batch-import', batchId }
            });
            logger.info(`Added ${type} ${validation.id} to queue from batch import`, 'BATCH');
        } else {
            throw new Error('Could not parse URL type/id');
        }
    }
}

export const batchImportService = new BatchImportService();
