import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import archiver from 'archiver';
import { parse } from 'csv-parse/sync';
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
const MAX_IMPORT_URLS = 1000;

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
        } catch (error: unknown) {
            logger.warn(`Resume: Failed to load (${(error as Error).message})`);
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
        } catch (error: unknown) {
            logger.error(`Resume: Failed to save (${(error as Error).message})`);
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

interface BatchArtifact {
    filePath: string;
    archiveName: string;
    cleanup: boolean;
}

export class BatchImportService {
    private activeBatches: Map<string, BatchStatus> = new Map();

    constructor() {
        this.setupListeners();
    }

    private setupListeners() {
        downloadQueue.on('item:completed', (item: any) => {
            if (item.metadata && item.metadata.batchId) {
                const batchId = String(item.metadata.batchId);
                if (item.metadata.batchFiles && Array.isArray(item.metadata.batchFiles)) {
                    this.updateBatchProgress(
                        batchId,
                        'completed',
                        undefined,
                        item.metadata.batchFiles as string[]
                    );
                } else {
                    this.updateBatchProgress(batchId, 'completed', item.filePath);
                }
            }
        });

        downloadQueue.on('item:failed', (item: any) => {
            if (item.metadata && item.metadata.batchId) {
                this.updateBatchProgress(String(item.metadata.batchId), 'failed');
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
            const downloadDir = path.resolve(CONFIG.download.outputDir || './downloads');
            const zipPath = path.join(downloadDir, zipName);
            const artifacts = this.collectBatchArtifacts(batch, downloadDir);

            const output = fs.createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            const zipClosed = new Promise<void>((resolve, reject) => {
                output.on('close', resolve);
                output.on('error', reject);
                archive.on('error', reject);
            });

            archive.pipe(output);

            for (const artifact of artifacts) {
                archive.file(artifact.filePath, { name: artifact.archiveName });
            }

            await archive.finalize();
            await zipClosed;

            logger.info(
                `Batch ZIP created: ${zipName} (${archive.pointer()} total bytes)`,
                'BATCH'
            );
            notifyBatchZipCreated(zipName, zipPath);
            this.cleanupBatchArtifacts(artifacts, downloadDir);
        } catch (error: unknown) {
            logger.error(`Failed to create ZIP: ${(error as Error).message}`, 'BATCH');
        }
    }

    private collectBatchArtifacts(batch: BatchStatus, downloadDir: string): BatchArtifact[] {
        const artifacts = new Map<string, BatchArtifact>();
        const cleanupCutoff = batch.createdAt - 5000;

        const addArtifact = (filePath: string, cleanup: boolean): void => {
            const resolved = path.resolve(filePath);
            if (!this.isPathInside(resolved, downloadDir) || !fs.existsSync(resolved)) return;

            const stats = fs.lstatSync(resolved);
            if (!stats.isFile()) return;

            const existing = artifacts.get(resolved);
            artifacts.set(resolved, {
                filePath: resolved,
                archiveName: path.relative(downloadDir, resolved),
                cleanup: cleanup || existing?.cleanup === true
            });
        };

        for (const file of batch.files) {
            const resolved = path.resolve(file);
            if (!this.isPathInside(resolved, downloadDir) || !fs.existsSync(resolved)) continue;

            const stats = fs.lstatSync(resolved);
            if (!stats.isFile()) continue;

            addArtifact(resolved, stats.mtimeMs >= cleanupCutoff);

            const containingDir = path.dirname(resolved);
            if (containingDir !== downloadDir) {
                for (const companionFile of this.findGeneratedCompanionFiles(resolved, cleanupCutoff)) {
                    addArtifact(companionFile, true);
                }
            }
        }

        return Array.from(artifacts.values()).sort((a, b) =>
            a.archiveName.localeCompare(b.archiveName)
        );
    }

    private findGeneratedCompanionFiles(filePath: string, cleanupCutoff: number): string[] {
        const files: string[] = [];
        const dir = path.dirname(filePath);
        const ext = path.extname(filePath);
        const base = path.basename(filePath, ext);
        const candidates = [
            path.join(dir, `${base}.lrc`),
            path.join(dir, 'cover.jpg'),
            path.join(dir, 'cover.jpeg'),
            path.join(dir, 'cover.png'),
            path.join(dir, 'cover.webp'),
            path.join(dir, 'folder.jpg'),
            path.join(dir, 'folder.jpeg'),
            path.join(dir, 'folder.png'),
            path.join(dir, 'folder.webp')
        ];

        for (const candidate of candidates) {
            try {
                if (!fs.existsSync(candidate)) continue;

                const stats = fs.lstatSync(candidate);
                if (stats.mtimeMs >= cleanupCutoff) {
                    files.push(candidate);
                }
            } catch (error: unknown) {
                logger.warn(
                    `Failed to inspect batch companion file ${candidate}: ${(error as Error).message}`,
                    'BATCH'
                );
            }
        }

        return files;
    }

    private cleanupBatchArtifacts(artifacts: BatchArtifact[], downloadDir: string): void {
        const touchedDirs = new Set<string>();

        for (const artifact of artifacts) {
            if (!artifact.cleanup) continue;

            try {
                if (fs.existsSync(artifact.filePath)) {
                    fs.unlinkSync(artifact.filePath);
                    touchedDirs.add(path.dirname(artifact.filePath));
                }
            } catch (error: unknown) {
                logger.warn(
                    `Failed to remove batch source file ${artifact.filePath}: ${(error as Error).message}`,
                    'BATCH'
                );
            }
        }

        for (const dir of Array.from(touchedDirs).sort((a, b) => b.length - a.length)) {
            this.pruneEmptyDirs(dir, downloadDir);
        }
    }

    private pruneEmptyDirs(startDir: string, downloadDir: string): void {
        let current = path.resolve(startDir);

        while (this.isPathInside(current, downloadDir) && current !== downloadDir) {
            try {
                if (fs.readdirSync(current).length > 0) return;
                fs.rmdirSync(current);
                current = path.dirname(current);
            } catch (error: unknown) {
                logger.warn(
                    `Failed to remove empty batch directory ${current}: ${(error as Error).message}`,
                    'BATCH'
                );
                return;
            }
        }
    }

    private isPathInside(candidate: string, parent: string): boolean {
        const relative = path.relative(parent, candidate);
        return (
            relative === '' ||
            (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative))
        );
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

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });

            if (records.length === 0) {
                return {
                    success: false,
                    imported: 0,
                    failed: 0,
                    errors: ['CSV file is empty or has no data rows']
                };
            }

            if (records.length > MAX_IMPORT_URLS) {
                return {
                    success: false,
                    imported: 0,
                    failed: 0,
                    errors: [`Import exceeds maximum limit of ${MAX_IMPORT_URLS} URLs`]
                };
            }

            // Find URL and Quality column keys (case-insensitive)
            const firstRecord = records[0] as Record<string, unknown>;
            const keys = Object.keys(firstRecord);
            const urlKey = keys.find((k) => k.toLowerCase() === 'url' || k.toLowerCase() === 'link');
            const qualityKey = keys.find((k) => k.toLowerCase() === 'quality' || k.toLowerCase() === 'format');

            if (!urlKey) {
                return {
                    success: false,
                    imported: 0,
                    failed: 0,
                    errors: ['CSV must have a "url" or "link" column']
                };
            }

            const urlsWithQuality: { url: string; quality: number }[] = records.map((row) => {
                const r = row as Record<string, string>;
                return {
                    url: r[urlKey],
                    quality: qualityKey ? parseInt(r[qualityKey]) || defaultQuality : defaultQuality
                };
            }).filter(item => item.url);

            let imported = 0;
            let failed = 0;
            const errors: string[] = [];

            for (const { url, quality } of urlsWithQuality) {
                try {
                    await this.addToQueue(url, quality);
                    imported++;
                } catch (error: unknown) {
                    failed++;
                    errors.push(`${url}: ${(error as Error).message}`);
                }
            }

            return { success: failed === 0, imported, failed, errors };
        } catch (error: unknown) {
            return {
                success: false,
                imported: 0,
                failed: 0,
                errors: [(error as Error).message]
            };
        }
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
        if (urls.length > MAX_IMPORT_URLS) {
            return {
                success: false,
                imported: 0,
                failed: 0,
                errors: [`Import exceeds maximum limit of ${MAX_IMPORT_URLS} URLs`]
            };
        }

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
            } catch (error: unknown) {
                failed++;
                errors.push(`${url}: ${(error as Error).message}`);
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
            const type = validation.type as 'track' | 'album' | 'playlist' | 'artist';
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
