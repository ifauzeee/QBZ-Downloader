import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { downloadQueue } from './queue/queue.js';
import { inputValidator } from '../utils/validator.js';

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

/**
 * Download Resume Service
 * Tracks partial downloads for resume capability
 */
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

    /**
     * Track a new partial download
     */
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

    /**
     * Update download progress
     */
    updateProgress(trackId: string, bytesDownloaded: number): void {
        const partial = this.partials.get(trackId);
        if (partial) {
            partial.bytesDownloaded = bytesDownloaded;
            this.save();
        }
    }

    /**
     * Mark download as complete and remove from tracking
     */
    completeDownload(trackId: string): void {
        this.partials.delete(trackId);
        this.save();
    }

    /**
     * Get partial download info if exists
     */
    getPartial(trackId: string): PartialDownload | undefined {
        return this.partials.get(trackId);
    }

    /**
     * Check if a partial download can be resumed
     */
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

    /**
     * Get resume byte position for a track
     */
    getResumePosition(trackId: string): number {
        const partial = this.partials.get(trackId);
        if (!partial) return 0;

        if (fs.existsSync(partial.filePath)) {
            const stats = fs.statSync(partial.filePath);
            return stats.size;
        }

        return 0;
    }

    /**
     * Get all resumable downloads
     */
    getResumable(): PartialDownload[] {
        const resumable: PartialDownload[] = [];
        for (const [id, partial] of this.partials) {
            if (this.canResume(id)) {
                resumable.push(partial);
            }
        }
        return resumable;
    }

    /**
     * Clear all partial downloads
     */
    clearAll(): void {
        this.partials.clear();
        this.save();
    }
}

export const resumeService = new ResumeService();

/**
 * Batch Import Service
 * Import URLs from files (txt, csv)
 */
export class BatchImportService {
    /**
     * Import URLs from a text file (one URL per line)
     */
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

    /**
     * Import URLs from CSV (expects 'url' column, optional 'quality' column)
     */
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

    /**
     * Import array of URLs
     */
    async importUrls(
        urls: string[],
        quality: number = 27
    ): Promise<{
        success: boolean;
        imported: number;
        failed: number;
        errors: string[];
    }> {
        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const url of urls) {
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

    /**
     * Parse and add URL to queue
     */
    private async addToQueue(url: string, quality: number): Promise<void> {
        const validation = inputValidator.validateUrl(url);

        if (!validation.valid) {
            throw new Error(validation.error || 'Invalid URL');
        }

        if (validation.type && validation.id) {
            downloadQueue.add(validation.type as any, validation.id, quality, {
                title: `${validation.type}: ${validation.id}`,
                metadata: { source: 'batch-import' }
            });
        } else {
            throw new Error('Could not parse URL type/id');
        }
    }
}

export const batchImportService = new BatchImportService();
