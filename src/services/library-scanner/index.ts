import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { databaseService } from '../database/index.js';
import { historyService } from '../history.js';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config.js';
import QobuzAPI from '../../api/qobuz.js';

function readFlacMetadata(
    filePath: string
): { bitDepth: number; sampleRate: number; duration: number } | null {
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const header = Buffer.alloc(4);

        fs.readSync(fd, header, 0, 4, 0);
        if (header.toString('ascii') !== 'fLaC') {
            fs.closeSync(fd);
            return null;
        }

        let offset = 4;
        let isLast = false;
        const blockHeader = Buffer.alloc(4);

        while (!isLast) {
            const bytesRead = fs.readSync(fd, blockHeader, 0, 4, offset);
            if (bytesRead < 4) break;

            const isLastBit = (blockHeader[0] >> 7) & 1;
            const type = blockHeader[0] & 0x7f;
            const length = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];

            isLast = isLastBit === 1;
            offset += 4;

            if (type === 0) {
                const buffer = Buffer.alloc(34);
                fs.readSync(fd, buffer, 0, 34, offset);

                const sampleRate =
                    (buffer[10] << 12) | (buffer[11] << 4) | ((buffer[12] & 0xf0) >> 4);
                const bitsPerSampleMinus1 = ((buffer[12] & 0x01) << 4) | ((buffer[13] & 0xf0) >> 4);
                const bitDepth = bitsPerSampleMinus1 + 1;

                const totalSamplesHi = buffer[13] & 0x0f;
                const totalSamplesLo =
                    (buffer[14] << 24) | (buffer[15] << 16) | (buffer[16] << 8) | buffer[17];
                const totalSamples = totalSamplesHi * 4294967296 + (totalSamplesLo >>> 0);

                const duration = sampleRate > 0 ? totalSamples / sampleRate : 0;

                fs.closeSync(fd);
                return { bitDepth, sampleRate, duration };
            }

            offset += length;
        }

        fs.closeSync(fd);
        return null;
    } catch {
        if (fd) {
            try {
                fs.closeSync(fd);
            } catch {}
        }
        return null;
    }
}

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

            this.emit('scan:started', { totalFiles: result.totalFiles, directory: scanDir });
            logger.info(
                `Starting library scan: ${result.totalFiles} files in ${scanDir}`,
                'SCANNER'
            );

            for (let i = 0; i < allFiles.length; i++) {
                if (this.scanAborted) {
                    logger.warn('Scan aborted by user', 'SCANNER');
                    break;
                }

                const filePath = allFiles[i];

                try {
                    const fileInfo = await this.scanFile(filePath);

                    if (fileInfo) {
                        result.scannedFiles++;
                        result.totalSize += fileInfo.fileSize;
                        result.byFormat[fileInfo.format] =
                            (result.byFormat[fileInfo.format] || 0) + 1;
                        result.byQuality[fileInfo.quality] =
                            (result.byQuality[fileInfo.quality] || 0) + 1;

                        if (fileInfo.needsUpgrade) result.upgradeableFiles++;
                        if (!fileInfo.title || !fileInfo.artist) result.missingMetadata++;

                        databaseService.addLibraryFile({
                            file_path: fileInfo.filePath,
                            title: fileInfo.title,
                            artist: fileInfo.artist,
                            album: fileInfo.album,
                            duration: fileInfo.duration,
                            quality: fileInfo.quality,
                            file_size: fileInfo.fileSize,
                            format: fileInfo.format,
                            bit_depth: fileInfo.bitDepth,
                            sample_rate: fileInfo.sampleRate,
                            needs_upgrade: fileInfo.needsUpgrade
                        });
                    }
                } catch (error: any) {
                    result.errors++;
                    logger.debug(`Error scanning ${filePath}: ${error.message}`, 'SCANNER');
                }

                if (i % 10 === 0 || i === allFiles.length - 1) {
                    this.emit('scan:progress', {
                        current: i + 1,
                        total: result.totalFiles,
                        percentage: Math.round(((i + 1) / result.totalFiles) * 100),
                        currentFile: path.basename(filePath),
                        status: 'scanning'
                    } as ScanProgress);
                }
            }

            if (options.detectDuplicates !== false) {
                this.emit('scan:progress', {
                    current: result.totalFiles,
                    total: result.totalFiles,
                    percentage: 100,
                    currentFile: 'Analyzing duplicates...',
                    status: 'analyzing'
                } as ScanProgress);
                result.duplicates = await this.detectDuplicates();
            }

            if (options.checkUpgrades !== false) {
                this.emit('scan:progress', {
                    current: 0,
                    total: result.scannedFiles,
                    percentage: 0,
                    currentFile: 'Checking available upgrades from Qobuz...',
                    status: 'checking_upgrades'
                } as ScanProgress);

                const upgradeCount = await this.checkQobuzUpgrades();
                result.upgradeableFiles = upgradeCount;
                logger.info(`Found ${upgradeCount} tracks with available upgrades`, 'SCANNER');
            }

            result.scanDuration = Date.now() - startTime;
            historyService.cleanup();

            this.emit('scan:complete', result);
            logger.success(
                `Library scan complete: ${result.scannedFiles} files, ${result.duplicates} duplicates, ${result.upgradeableFiles} upgradeable`,
                'SCANNER'
            );

            return result;
        } finally {
            this.isScanning = false;
        }
    }

    private async collectAudioFiles(directory: string): Promise<string[]> {
        const files: string[] = [];
        const scan = async (dir: string): Promise<void> => {
            if (!fs.existsSync(dir)) return;
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

                const searchResult = await this.api.search(searchQuery, 'tracks', 5);
                if (!searchResult.success || !searchResult.data?.tracks?.items?.length) {
                    processed++;
                    continue;
                }

                const track = this.findBestMatch(
                    file.title || '',
                    file.artist || '',
                    searchResult.data.tracks.items
                );
                if (!track) {
                    processed++;
                    continue;
                }

                const availableQuality = await this.getHighestAvailableQuality(track.id);

                if (availableQuality && availableQuality > file.quality) {
                    db.prepare(
                        'UPDATE library_files SET track_id = ?, available_quality = ?, needs_upgrade = 1 WHERE file_path = ?'
                    ).run(String(track.id), availableQuality, file.file_path);
                    upgradeCount++;
                    logger.debug(
                        `Upgrade available: ${file.artist} - ${file.title} (${this.getQualityLabel(file.quality)} → ${this.getQualityLabel(availableQuality)})`,
                        'SCANNER'
                    );
                } else {
                    db.prepare(
                        'UPDATE library_files SET needs_upgrade = 0 WHERE file_path = ?'
                    ).run(file.file_path);
                }

                processed++;
                if (processed % 5 === 0) {
                    this.emit('scan:progress', {
                        current: processed,
                        total: files.length,
                        percentage: Math.round((processed / files.length) * 100),
                        currentFile: `Checking: ${file.artist} - ${file.title}`,
                        status: 'checking_upgrades'
                    } as ScanProgress);
                }
                await this.delay(200);
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

    private findBestMatch(title: string, artist: string, tracks: any[]): any | null {
        const normalizedTitle = this.normalizeString(title);
        const normalizedArtist = this.normalizeString(artist);
        for (const track of tracks) {
            const trackTitle = this.normalizeString(track.title || '');
            const trackArtist = this.normalizeString(
                track.performer?.name || track.album?.artist?.name || ''
            );
            if (
                this.similarity(normalizedTitle, trackTitle) > 0.8 &&
                this.similarity(normalizedArtist, trackArtist) > 0.7
            ) {
                return track;
            }
        }
        return null;
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

    private async scanFile(filePath: string): Promise<LibraryFile | null> {
        try {
            const stats = fs.statSync(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const filename = path.basename(filePath, ext);
            const parentDir = path.basename(path.dirname(filePath));
            const artistDir = path.basename(path.dirname(path.dirname(filePath)));

            let title = filename;
            let artist = artistDir || 'Unknown';
            const album = parentDir || 'Unknown';

            const patterns = [/^(.+?)\s*-\s*(.+)$/, /^\d+\.\s*(.+)$/, /^\d+\s*-\s*(.+)$/];
            for (const pattern of patterns) {
                const match = filename.match(pattern);
                if (match) {
                    if (match.length === 3) {
                        artist = match[1].trim();
                        title = match[2].trim();
                    } else {
                        title = match[1].trim();
                    }
                    break;
                }
            }

            let quality = 6;
            let bitDepth = 16;
            let sampleRate = 44100;
            let duration = 0;

            if (ext === '.mp3') {
                quality = 5;
                bitDepth = 0;
                sampleRate = 0;
            } else if (ext === '.flac') {
                const flacMeta = readFlacMetadata(filePath);
                if (flacMeta) {
                    bitDepth = flacMeta.bitDepth;
                    sampleRate = flacMeta.sampleRate;
                    duration = flacMeta.duration;
                    if (bitDepth >= 24 && sampleRate >= 176400) quality = 27;
                    else if (bitDepth >= 24) quality = 7;
                    else quality = 6;
                } else {
                    const mbPerMinute = stats.size / (1024 * 1024) / 4;
                    if (mbPerMinute > 20) {
                        quality = 27;
                        bitDepth = 24;
                        sampleRate = 192000;
                    } else if (mbPerMinute > 10) {
                        quality = 7;
                        bitDepth = 24;
                        sampleRate = 96000;
                    } else {
                        quality = 6;
                        bitDepth = 16;
                        sampleRate = 44100;
                    }
                }
            }

            return {
                filePath,
                title,
                artist,
                album,
                duration: duration || 0,
                quality,
                fileSize: stats.size,
                format: ext.slice(1).toUpperCase(),
                bitDepth,
                sampleRate,
                needsUpgrade: quality < 7
            };
        } catch {
            return null;
        }
    }

    private async detectDuplicates(): Promise<number> {
        const files = databaseService.getLibraryFiles(10000, 0);
        const duplicateGroups: Map<string, string[]> = new Map();
        let duplicateCount = 0;
        for (const file of files) {
            if (!file.title || !file.artist) continue;
            const key = `${this.normalizeString(file.artist)}|${this.normalizeString(file.title)}`;
            if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
            duplicateGroups.get(key)!.push(file.file_path);
        }
        for (const [, paths] of duplicateGroups) {
            if (paths.length > 1) {
                duplicateCount += paths.length - 1;
                for (let i = 1; i < paths.length; i++) {
                    databaseService.addDuplicate(paths[0], paths[i], 'exact', 0.95);
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
                groups.get(key)!.files.push({ path: dup.file_path_2, size: 0, quality: 0 });
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
    } {
        const upgradeable = databaseService.getUpgradeableFiles();
        const duplicates = databaseService.getDuplicates();
        const db = databaseService.getDb();
        const totalRow = db
            .prepare('SELECT COUNT(*) as count, SUM(file_size) as size FROM library_files')
            .get() as any;
        return {
            totalFiles: totalRow?.count || 0,
            duplicates: duplicates.length,
            upgradeable: upgradeable.length,
            totalSize: totalRow?.size || 0
        };
    }

    async findMissingTracks(): Promise<any[]> {
        return [];
    }
}

export const libraryScannerService = new LibraryScannerService();
export default libraryScannerService;
