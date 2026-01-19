import fs from 'fs';
import path from 'path';
import os from 'os';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { databaseService } from '../database/index.js';
import { historyService } from '../history.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config.js';
import QobuzAPI from '../../api/qobuz.js';

export interface LibraryFile {
    filePath: string;
    trackId?: string;
    title: string;
    artist: string;
    album: string;
    duration: number;
    quality: number;
    availableQuality?: number;
    fileSize: number;
    format: string;
    bitDepth: number;
    sampleRate: number;
    needsUpgrade: boolean;
    missingTags?: string[];
}

export interface DuplicateGroup {
    id: number;
    files: {
        path: string;
        size: number;
        quality: number;
    }[];
    matchType: 'exact' | 'similar' | 'remaster';
    recommendation: string;
}

export interface ScanResult {
    totalFiles: number;
    scannedFiles: number;
    errors: number;
    duplicates: number;
    upgradeableFiles: number;
    missingMetadata: number;
    totalSize: number;
    scanDuration: number;
    byFormat: Record<string, number>;
    byQuality: Record<number, number>;
}

export interface ScanProgress {
    current: number;
    total: number;
    percentage: number;
    currentFile: string;
    status: 'scanning' | 'analyzing' | 'checking_upgrades' | 'complete' | 'error';
}

class LibraryScannerService extends EventEmitter {
    private isScanning = false;
    private scanAborted = false;
    private supportedFormats = ['.flac', '.mp3', '.wav', '.aiff', '.alac', '.m4a', '.ogg'];
    private api: QobuzAPI;
    private currentProgress: ScanProgress | null = null;

    constructor() {
        super();
        this.api = new QobuzAPI();
    }

    async scanLibrary(
        directory?: string,
        options: {
            detectDuplicates?: boolean;
            checkUpgrades?: boolean;
            deep?: boolean;
        } = {}
    ): Promise<ScanResult> {
        if (this.isScanning) {
            throw new Error('Scan already in progress');
        }

        const scanDir = directory || CONFIG.download.outputDir;
        const startTime = Date.now();

        this.isScanning = true;
        this.scanAborted = false;
        this.currentProgress = {
            current: 0,
            total: 0,
            percentage: 0,
            currentFile: 'Starting scan...',
            status: 'scanning'
        };

        const result: ScanResult = {
            totalFiles: 0,
            scannedFiles: 0,
            errors: 0,
            duplicates: 0,
            upgradeableFiles: 0,
            missingMetadata: 0,
            totalSize: 0,
            scanDuration: 0,
            byFormat: {},
            byQuality: {}
        };

        try {
            databaseService.clearLibraryScan();

            const allFiles = await this.collectAudioFiles(scanDir);
            result.totalFiles = allFiles.length;

            if (result.totalFiles === 0) {
                this.isScanning = false;
                return result;
            }

            this.currentProgress.total = result.totalFiles;

            this.emit('scan:started', { totalFiles: result.totalFiles, directory: scanDir });
            logger.info(
                `Starting multi-threaded library scan: ${result.totalFiles} files in ${scanDir}`,
                'SCANNER'
            );

            const numWorkers = Math.min(allFiles.length, os.cpus().length || 4);
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const workerPathJs = path.join(__dirname, 'worker.js');
            const workerPathTs = path.join(__dirname, 'worker.ts');

            const resolvedWorkerPath = fs.existsSync(workerPathJs) ? workerPathJs : workerPathTs;

            const filesToProcess = [...allFiles];
            let processedCount = 0;

            const processResult = (fileInfo: any) => {
                if (fileInfo.error) {
                    result.errors++;
                    logger.debug(
                        `Error scanning ${fileInfo.filePath}: ${fileInfo.error}`,
                        'SCANNER'
                    );
                } else if (fileInfo) {
                    result.scannedFiles++;
                    result.totalSize += fileInfo.fileSize;
                    result.byFormat[fileInfo.format] = (result.byFormat[fileInfo.format] || 0) + 1;
                    result.byQuality[fileInfo.quality] =
                        (result.byQuality[fileInfo.quality] || 0) + 1;

                    if (fileInfo.needsUpgrade) result.upgradeableFiles++;
                    if (fileInfo.missingInternalTags) result.missingMetadata++;

                    databaseService.addLibraryFile({
                        file_path: fileInfo.filePath,
                        title: fileInfo.title,
                        artist: fileInfo.artist,
                        album_artist: fileInfo.albumArtist,
                        album: fileInfo.album,
                        duration: fileInfo.duration,
                        quality: fileInfo.quality,
                        file_size: fileInfo.fileSize,
                        format: fileInfo.format,
                        bit_depth: fileInfo.bitDepth,
                        sample_rate: fileInfo.sampleRate,
                        needs_upgrade: fileInfo.needsUpgrade,
                        audio_fingerprint: fileInfo.audioFingerprint,
                        missing_metadata: fileInfo.missingInternalTags,
                        missing_tags: fileInfo.missingTags
                    });
                }

                processedCount++;
                const progress: ScanProgress = {
                    current: processedCount,
                    total: result.totalFiles,
                    percentage: Math.round((processedCount / result.totalFiles) * 100),
                    currentFile: path.basename(fileInfo.filePath || ''),
                    status: 'scanning'
                };
                this.currentProgress = progress;
                this.emit('scan:progress', progress);
            };

            await new Promise<void>((resolve) => {
                let workersFinished = 0;

                const spawnWorker = () => {
                    if (filesToProcess.length === 0 || this.scanAborted) {
                        workersFinished++;
                        if (workersFinished >= numWorkers) resolve();
                        return;
                    }

                    const worker = new Worker(resolvedWorkerPath, {
                        execArgv: resolvedWorkerPath.endsWith('.ts')
                            ? ['--loader', 'ts-node/esm']
                            : []
                    });

                    worker.on('message', (msg) => {
                        processResult(msg);
                        if (filesToProcess.length > 0 && !this.scanAborted) {
                            worker.postMessage(filesToProcess.pop());
                        } else {
                            worker.terminate();
                            workersFinished++;
                            if (workersFinished >= numWorkers) resolve();
                        }
                    });

                    worker.on('error', (err) => {
                        result.errors++;
                        logger.error(`Worker error: ${err.message}`, 'SCANNER');
                        worker.terminate();
                        workersFinished++;
                        if (workersFinished >= numWorkers) resolve();
                    });

                    worker.postMessage(filesToProcess.pop());
                };

                for (let i = 0; i < numWorkers; i++) {
                    spawnWorker();
                }
            });

            if (this.scanAborted) {
                logger.warn('Scan aborted by user', 'SCANNER');
            }

            if (options.detectDuplicates !== false) {
                const progress: ScanProgress = {
                    current: result.totalFiles,
                    total: result.totalFiles,
                    percentage: 100,
                    currentFile: 'Analyzing duplicates...',
                    status: 'analyzing'
                };
                this.currentProgress = progress;
                this.emit('scan:progress', progress);
                result.duplicates = await this.detectDuplicates();
            }

            if (options.checkUpgrades !== false) {
                const progress: ScanProgress = {
                    current: 0,
                    total: result.scannedFiles,
                    percentage: 0,
                    currentFile: 'Checking available upgrades from Qobuz...',
                    status: 'checking_upgrades'
                };
                this.currentProgress = progress;
                this.emit('scan:progress', progress);

                const upgradeCount = await this.checkQobuzUpgrades();
                result.upgradeableFiles = upgradeCount;
                logger.info(`Found ${upgradeCount} tracks with available upgrades`, 'SCANNER');
            }

            result.scanDuration = Date.now() - startTime;
            historyService.cleanup();

            const finalProgress: ScanProgress = {
                current: result.totalFiles,
                total: result.totalFiles,
                percentage: 100,
                currentFile: 'Scan complete',
                status: 'complete'
            };
            this.currentProgress = finalProgress;
            this.emit('scan:progress', finalProgress);

            this.emit('scan:complete', result);
            logger.success(
                `Library scan complete: ${result.scannedFiles} files, ${result.duplicates} duplicates, ${result.upgradeableFiles} upgradeable`,
                'SCANNER'
            );

            return result;
        } finally {
            this.isScanning = false;
            this.currentProgress = null;
        }
    }

    private async collectAudioFiles(directory: string): Promise<string[]> {
        const files: string[] = [];
        const scan = async (dir: string): Promise<void> => {
            if (!fs.existsSync(dir)) return;
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dir, entry.name);
                    if (entry.isDirectory()) {
                        await scan(fullPath);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name).toLowerCase();
                        if (this.supportedFormats.includes(ext)) {
                            files.push(fullPath);
                        }
                    }
                }
            } catch (err) {
                logger.debug(`Failed to scan directory ${dir}: ${err}`);
            }
        };
        await scan(directory);
        return files;
    }

    private async checkQobuzUpgrades(): Promise<number> {
        const db = databaseService.getDb();
        const files = databaseService.getLibraryFiles(10000, 0);
        let upgradeCount = 0;
        let processed = 0;

        for (const file of files) {
            if (this.scanAborted) break;

            if (file.track_id && file.available_quality !== null) {
                if (file.available_quality > file.quality) upgradeCount++;
                processed++;
                continue;
            }

            if (file.quality >= 27) {
                processed++;
                continue;
            }

            try {
                const searchQuery = `${file.artist} ${file.title}`.trim();
                if (!searchQuery || searchQuery === 'Unknown Unknown') {
                    processed++;
                    continue;
                }

                const searchResult = await this.api.search(searchQuery, 'tracks', 10);
                if (!searchResult.success || !searchResult.data?.tracks?.items?.length) {
                    processed++;
                    continue;
                }

                const matches = this.findAllMatches(
                    file.title || '',
                    file.artist || '',
                    searchResult.data.tracks.items
                );

                if (matches.length === 0) {
                    processed++;
                    continue;
                }

                let maxQualityFound = 0;
                let bestTrackId = null;

                for (const track of matches.slice(0, 5)) {
                    const quality = await this.getHighestAvailableQuality(track.id);
                    if (quality !== null && quality > maxQualityFound) {
                        maxQualityFound = quality;
                        bestTrackId = track.id;
                        if (maxQualityFound >= 27) break;
                    }
                }

                if (bestTrackId && maxQualityFound > file.quality) {
                    db.prepare(
                        'UPDATE library_files SET track_id = ?, available_quality = ?, needs_upgrade = 1 WHERE file_path = ?'
                    ).run(String(bestTrackId), maxQualityFound, file.file_path);
                    upgradeCount++;
                    logger.debug(
                        `Upgrade available: ${file.artist} - ${file.title} (${this.getQualityLabel(file.quality)} → ${this.getQualityLabel(maxQualityFound)})`,
                        'SCANNER'
                    );
                } else if (bestTrackId) {
                    db.prepare(
                        'UPDATE library_files SET track_id = ?, available_quality = ?, needs_upgrade = 0 WHERE file_path = ?'
                    ).run(String(bestTrackId), maxQualityFound || file.quality, file.file_path);
                } else {
                    db.prepare(
                        'UPDATE library_files SET needs_upgrade = 0 WHERE file_path = ?'
                    ).run(file.file_path);
                }

                processed++;
                const progress: ScanProgress = {
                    current: processed,
                    total: files.length,
                    percentage: Math.round((processed / files.length) * 100),
                    currentFile: `Checking: ${file.artist} - ${file.title}`,
                    status: 'checking_upgrades'
                };
                this.currentProgress = progress;
                this.emit('scan:progress', progress);
                await this.delay(process.env.NODE_ENV === 'test' ? 0 : 50);
            } catch (error: any) {
                logger.debug(
                    `Error checking upgrade for ${file.file_path}: ${error.message}`,
                    'SCANNER'
                );
                processed++;
            }
        }
        return upgradeCount;
    }

    private findAllMatches(title: string, artist: string, tracks: any[]): any[] {
        const normalizedTitle = this.normalizeString(title);
        const normalizedArtist = this.normalizeString(artist);
        const matches: any[] = [];

        for (const track of tracks) {
            const trackTitle = this.normalizeString(track.title || '');
            const trackArtist = this.normalizeString(
                track.performer?.name || track.album?.artist?.name || ''
            );

            const titleScore = this.similarity(normalizedTitle, trackTitle);
            const artistScore = this.similarity(normalizedArtist, trackArtist);

            if (titleScore > 0.8 && artistScore > 0.6) {
                matches.push(track);
            }
        }
        return matches;
    }

    private async getHighestAvailableQuality(trackId: number): Promise<number | null> {
        const qualities = [27, 7, 6, 5];
        for (const quality of qualities) {
            try {
                const result = await this.api.getFileUrl(trackId, quality);
                if (result.success && result.data) {
                    return (result.data as any).format_id || quality;
                }
            } catch {}
        }
        return null;
    }

    private similarity(str1: string, str2: string): number {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0) return 1;
        if (longer.includes(shorter) || shorter.includes(longer)) return 0.9;
        const editDistance = this.levenshteinDistance(str1, str2);
        return (longer.length - editDistance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
        for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }

    private getQualityLabel(quality: number): string {
        const labels: Record<number, string> = {
            5: 'MP3 320',
            6: 'FLAC 16/44',
            7: 'FLAC 24/96',
            27: 'FLAC 24/192'
        };
        return labels[quality] || `Q${quality}`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async detectDuplicates(): Promise<number> {
        const files = databaseService.getLibraryFiles(100000, 0);
        logger.debug(
            `[DUPLICATE_CHECK] Analyzing ${files.length} items for duplicates...`,
            'SCANNER'
        );

        const fingerprintGroups = new Map<string, string[]>();
        const titleGroups = new Map<string, { filePath: string; artist: string }[]>();

        for (const file of files) {
            if (file.audio_fingerprint) {
                const key = file.audio_fingerprint;
                if (!fingerprintGroups.has(key)) fingerprintGroups.set(key, []);
                fingerprintGroups.get(key)!.push(file.file_path);
            }

            if (file.title) {
                const normTitle = this.normalizeString(file.title);
                if (!normTitle || normTitle.length < 2) continue;

                if (!titleGroups.has(normTitle)) titleGroups.set(normTitle, []);

                titleGroups.get(normTitle)!.push({
                    filePath: file.file_path,
                    artist: file.artist || ''
                });

                if (normTitle.includes('stereo love')) {
                    logger.debug(
                        `[DUPLICATE_CHECK] Added to title group '${normTitle}': ${path.basename(file.file_path)} (Artist: ${file.artist})`,
                        'SCANNER'
                    );
                }
            }
        }

        let duplicateCount = 0;
        const processedPairs = new Set<string>();

        const registerDuplicate = (
            path1: string,
            path2: string,
            type: 'exact' | 'similar',
            confidence: number
        ) => {
            const paths = [path1, path2].sort();
            const pairKey = paths.join('|');

            if (!processedPairs.has(pairKey)) {
                processedPairs.add(pairKey);
                databaseService.addDuplicate(path1, path2, type, confidence);
                duplicateCount++;
                logger.debug(
                    `[DUPLICATE_CHECK] Found duplicate (${type}): ${path.basename(path1)} = ${path.basename(path2)}`,
                    'SCANNER'
                );
            }
        };

        for (const paths of fingerprintGroups.values()) {
            if (paths.length > 1) {
                for (let i = 0; i < paths.length; i++) {
                    for (let j = i + 1; j < paths.length; j++) {
                        registerDuplicate(paths[i], paths[j], 'exact', 1.0);
                    }
                }
            }
        }

        for (const [_, items] of titleGroups) {
            if (items.length < 2) continue;

            for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                    const item1 = items[i];
                    const item2 = items[j];

                    if (item1.filePath === item2.filePath) continue;

                    const paths = [item1.filePath, item2.filePath].sort();
                    if (processedPairs.has(paths.join('|'))) continue;

                    const artist1 = this.normalizeString(item1.artist);
                    const artist2 = this.normalizeString(item2.artist);

                    if (artist1 === artist2) {
                        registerDuplicate(item1.filePath, item2.filePath, 'similar', 0.95);
                        continue;
                    }

                    if (artist1.includes(artist2) || artist2.includes(artist1)) {
                        registerDuplicate(item1.filePath, item2.filePath, 'similar', 0.9);
                        continue;
                    }

                    const score = this.similarity(artist1, artist2);
                    if (score > 0.8) {
                        registerDuplicate(item1.filePath, item2.filePath, 'similar', 0.85);
                    }
                }
            }
        }

        return duplicateCount;
    }

    private normalizeString(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getDuplicates(): DuplicateGroup[] {
        const rawDuplicates = databaseService.getDuplicates();
        const groups: Map<string, DuplicateGroup> = new Map();
        for (const dup of rawDuplicates) {
            const key = dup.file_path_1;

            if (!groups.has(key)) {
                groups.set(key, {
                    id: dup.id,
                    files: [
                        { path: dup.file_path_1, size: 0, quality: 0 },
                        { path: dup.file_path_2, size: 0, quality: 0 }
                    ],
                    matchType: dup.match_type as any,
                    recommendation: 'Keep the higher quality version'
                });
            } else {
                const existing = groups.get(key)!.files.find((f) => f.path === dup.file_path_2);
                if (!existing) {
                    groups.get(key)!.files.push({ path: dup.file_path_2, size: 0, quality: 0 });
                }
            }
        }
        return Array.from(groups.values());
    }

    getUpgradeableFiles(): LibraryFile[] {
        const files = databaseService.getUpgradeableFiles();
        return files.map((f) => ({
            filePath: f.file_path,
            trackId: f.track_id || undefined,
            title: f.title || '',
            artist: f.artist || '',
            album: f.album || '',
            duration: f.duration || 0,
            quality: f.quality || 0,
            availableQuality: f.available_quality || undefined,
            fileSize: f.file_size || 0,
            format: f.format || '',
            bitDepth: f.bit_depth || 0,
            sampleRate: f.sample_rate || 0,
            needsUpgrade: true
        }));
    }

    getMissingMetadataFiles(): LibraryFile[] {
        const files = databaseService.getMissingMetadataFiles();
        return files.map((f) => ({
            filePath: f.file_path,
            trackId: f.track_id || undefined,
            title: f.title || '',
            artist: f.artist || '',
            album: f.album || '',
            duration: f.duration || 0,
            quality: f.quality || 0,
            availableQuality: f.available_quality || undefined,
            fileSize: f.file_size || 0,
            format: f.format || '',
            bitDepth: f.bit_depth || 0,
            sampleRate: f.sample_rate || 0,
            needsUpgrade: false,
            missingTags: f.missing_tags ? JSON.parse(f.missing_tags) : []
        }));
    }

    async resolveDuplicate(id: number): Promise<void> {
        const db = databaseService.getDb();
        const duplicate = db.prepare('SELECT * FROM duplicates WHERE id = ?').get(id) as any;
        if (!duplicate) return;
        const file1 = db
            .prepare('SELECT * FROM library_files WHERE file_path = ?')
            .get(duplicate.file_path_1) as any;
        const file2 = db
            .prepare('SELECT * FROM library_files WHERE file_path = ?')
            .get(duplicate.file_path_2) as any;
        if (!file1 || !file2) {
            databaseService.resolveDuplicate(id);
            return;
        }
        let fileToDelete: string;
        let fileToKeep: string;
        if ((file1.quality || 0) > (file2.quality || 0)) {
            fileToDelete = file2.file_path;
            fileToKeep = file1.file_path;
        } else if ((file2.quality || 0) > (file1.quality || 0)) {
            fileToDelete = file1.file_path;
            fileToKeep = file2.file_path;
        } else {
            if ((file1.file_size || 0) >= (file2.file_size || 0)) {
                fileToDelete = file2.file_path;
                fileToKeep = file1.file_path;
            } else {
                fileToDelete = file1.file_path;
                fileToKeep = file2.file_path;
            }
        }
        try {
            if (fs.existsSync(fileToDelete)) {
                fs.unlinkSync(fileToDelete);
                databaseService.deleteTrackByPath(fileToDelete);
                historyService.cleanup();
                logger.info(
                    `Resolved duplicate by deleting: ${path.basename(fileToDelete)} (kept ${path.basename(fileToKeep)})`,
                    'SCANNER'
                );
            }
        } catch (err: any) {
            logger.error(
                `Failed to delete duplicate file ${fileToDelete}: ${err.message}`,
                'SCANNER'
            );
        }
        db.prepare('DELETE FROM library_files WHERE file_path = ?').run(fileToDelete);
        db.prepare(
            'UPDATE duplicates SET resolved = 1 WHERE file_path_1 = ? OR file_path_2 = ?'
        ).run(fileToDelete, fileToDelete);
        databaseService.resolveDuplicate(id);
    }

    async deleteFile(filePath: string): Promise<boolean> {
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            return true;
        } catch (error: any) {
            logger.error(`Failed to delete file: ${error.message}`, 'SCANNER');
            return false;
        }
    }

    abortScan(): void {
        if (this.isScanning) this.scanAborted = true;
    }

    isScanInProgress(): boolean {
        return this.isScanning;
    }

    getScanStats(): {
        totalFiles: number;
        duplicates: number;
        upgradeable: number;
        totalSize: number;
        processedFiles?: number;
        currentFile?: string;
    } {
        const upgradeable = databaseService.getUpgradeableFiles();
        const duplicates = databaseService.getDuplicates();
        const db = databaseService.getDb();
        const totalRow = db
            .prepare('SELECT COUNT(*) as count, SUM(file_size) as size FROM library_files')
            .get() as any;

        const stats = {
            totalFiles: totalRow?.count || 0,
            duplicates: duplicates.length,
            upgradeable: upgradeable.length,
            totalSize: totalRow?.size || 0
        };

        if (this.isScanning && this.currentProgress) {
            return {
                ...stats,
                totalFiles:
                    this.currentProgress.total > 0 ? this.currentProgress.total : stats.totalFiles,
                processedFiles: this.currentProgress.current,
                currentFile: this.currentProgress.currentFile
            };
        }

        return stats;
    }

    async findMissingTracks(): Promise<any[]> {
        return [];
    }
}

export const libraryScannerService = new LibraryScannerService();
export default libraryScannerService;
