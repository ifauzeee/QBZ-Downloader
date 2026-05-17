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
import qobuzApi from '../../api/qobuz.js';

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
    upgradeCandidates?: UpgradeCandidate[];
}

export interface UpgradeCandidate {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    quality: number;
    qualityLabel: string;
    albumId?: string;
    coverUrl?: string;
    duration?: number;
    releaseDate?: string;
    matchScore: number;
    titleScore: number;
    artistScore: number;
    albumScore: number;
    variantWarning: boolean;
}

type UpgradeSearchTrack = {
    id: string | number;
    title?: string;
    duration?: number;
    version?: string;
    performer?: { name?: string };
    artist?: { name?: string };
    album?: {
        id?: string | number;
        title?: string;
        released_at?: number;
        release_date_original?: string;
        release_date_download?: string;
        artist?: { name?: string };
        image?: {
            small?: string;
            thumbnail?: string;
            medium?: string;
            large?: string;
            extralarge?: string;
            mega?: string;
            [key: string]: unknown;
        };
    };
}

export interface WorkerResult {
    filePath: string;
    title?: string;
    artist?: string;
    albumArtist?: string;
    album?: string;
    duration?: number;
    quality?: number;
    fileSize?: number;
    format?: string;
    bitDepth?: number;
    sampleRate?: number;
    needsUpgrade?: boolean;
    audioFingerprint?: string;
    checksum?: string;
    missingInternalTags?: boolean;
    missingTags?: string[];
    error?: string;
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

import { checkBinaryAvailability } from '../../utils/binaries.js';

export class LibraryScannerService extends EventEmitter {

    private isScanning = false;
    private scanAborted = false;
    private supportedFormats = ['.flac', '.mp3', '.wav', '.aiff', '.alac', '.m4a', '.ogg'];
    private api = qobuzApi;
    private static fpcalcAvailable: boolean | null = null;
    private currentProgress: ScanProgress | null = null;

    constructor() {
        super();
    }

    private async checkFpcalc(): Promise<boolean> {
        if (LibraryScannerService.fpcalcAvailable !== null) return LibraryScannerService.fpcalcAvailable;
        
        const info = await checkBinaryAvailability('fpcalc');
        LibraryScannerService.fpcalcAvailable = info.available;

        if (!info.available) {
            logger.warn(
                'fpcalc (Chromaprint) not found. Audio fingerprinting will be disabled. Duplicates will rely on metadata only.',
                'SCANNER'
            );
        } else {
            logger.debug(`fpcalc detected at: ${info.path}`, 'SCANNER');
        }

        return info.available;
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

            await this.checkFpcalc();
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

            const processResult = (fileInfo: WorkerResult) => {
                if (fileInfo.error) {
                    result.errors++;
                    logger.debug(
                        `Error scanning ${fileInfo.filePath}: ${fileInfo.error}`,
                        'SCANNER'
                    );
                } else if (fileInfo) {
                    result.scannedFiles++;
                    result.totalSize += fileInfo.fileSize || 0;
                    if (fileInfo.format) {
                        result.byFormat[fileInfo.format] = (result.byFormat[fileInfo.format] || 0) + 1;
                    }
                    if (fileInfo.quality !== undefined) {
                        result.byQuality[fileInfo.quality] =
                            (result.byQuality[fileInfo.quality] || 0) + 1;
                    }

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
                        missing_tags: fileInfo.missingTags,
                        checksum: fileInfo.checksum,
                        verification_status: fileInfo.checksum ? 'verified' : 'pending'
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
                `Library scan complete: ${result.scannedFiles} files, ${result.duplicates} duplicates, ${result.upgradeableFiles} upgradeable, ${result.missingMetadata} missing metadata`,
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
        const files = databaseService.getLibraryFiles(10000, 0) as unknown as {
            file_path: string;
            track_id?: string | null;
            available_quality?: number | null;
            upgrade_candidates?: string | null;
            quality: number;
            artist?: string | null;
            title?: string | null;
            album?: string | null;
        }[];
        let upgradeCount = 0;
        let processed = 0;

        for (const file of files) {
            if (this.scanAborted) break;

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
                    file.album || '',
                    searchResult.data.tracks.items as unknown as UpgradeSearchTrack[]
                );

                if (matches.length === 0) {
                    db.prepare(
                        'UPDATE library_files SET needs_upgrade = 0, upgrade_candidates = NULL WHERE file_path = ?'
                    ).run(file.file_path);
                    processed++;
                    continue;
                }

                const candidates: UpgradeCandidate[] = [];

                for (const track of matches.slice(0, 8)) {
                    const quality = await this.getHighestAvailableQuality(track.id);
                    if (quality !== null && quality > file.quality) {
                        candidates.push(
                            this.buildUpgradeCandidate(
                                track,
                                quality,
                                file.title || '',
                                file.artist || '',
                                file.album || ''
                            )
                        );
                    }
                }

                candidates.sort((a, b) => {
                    if (b.quality !== a.quality) return b.quality - a.quality;
                    return b.matchScore - a.matchScore;
                });

                const uniqueCandidates = this.dedupeUpgradeCandidates(candidates).slice(0, 5);
                const bestCandidate = uniqueCandidates[0];

                if (bestCandidate) {
                    db.prepare(
                        'UPDATE library_files SET track_id = ?, available_quality = ?, upgrade_candidates = ?, needs_upgrade = 1 WHERE file_path = ?'
                    ).run(
                        bestCandidate.trackId,
                        bestCandidate.quality,
                        JSON.stringify(uniqueCandidates),
                        file.file_path
                    );
                    upgradeCount++;
                    logger.debug(
                        `Upgrade candidates available: ${file.artist} - ${file.title} (${uniqueCandidates.length} option(s), best ${this.getQualityLabel(bestCandidate.quality)})`,
                        'SCANNER'
                    );
                } else {
                    db.prepare(
                        'UPDATE library_files SET needs_upgrade = 0, upgrade_candidates = NULL WHERE file_path = ?'
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
            } catch (error: unknown) {
                logger.debug(
                    `Error checking upgrade for ${file.file_path}: ${(error as Error).message}`,
                    'SCANNER'
                );
                processed++;
            }
        }
        return upgradeCount;
    }

    private findAllMatches(
        title: string,
        artist: string,
        album: string,
        tracks: UpgradeSearchTrack[]
    ): UpgradeSearchTrack[] {
        const normalizedTitle = this.normalizeString(title);
        const normalizedArtist = this.normalizeString(artist);
        const normalizedAlbum = this.normalizeString(album);
        const matches: { track: UpgradeSearchTrack; score: number }[] = [];

        for (const track of tracks) {
            const trackTitle = this.normalizeString(track.title || '');
            const trackArtist = this.normalizeString(
                track.performer?.name || track.artist?.name || track.album?.artist?.name || ''
            );
            const trackAlbum = this.normalizeString(track.album?.title || '');

            const titleScore = this.similarity(normalizedTitle, trackTitle);
            const artistScore = this.similarity(normalizedArtist, trackArtist);
            const albumScore = this.similarity(normalizedAlbum, trackAlbum);
            const variantWarning = this.hasDistinctVersionContext(
                { filePath: '', title, album },
                { filePath: '', title: track.title || '', album: track.album?.title || '' }
            );

            if (titleScore > 0.75 && artistScore > 0.55) {
                const strongIdentityMatch = titleScore >= 0.95 && artistScore >= 0.8;
                if (normalizedAlbum && albumScore < 0.5 && !strongIdentityMatch && !variantWarning) {
                    continue;
                }

                const variantPenalty = variantWarning ? 0.12 : 0;
                const score = titleScore * 0.5 + artistScore * 0.3 + albumScore * 0.2 - variantPenalty;
                matches.push({ track, score });
            }
        }
        return matches.sort((a, b) => b.score - a.score).map((match) => match.track);
    }

    private buildUpgradeCandidate(
        track: UpgradeSearchTrack,
        quality: number,
        sourceTitle: string,
        sourceArtist: string,
        sourceAlbum: string
    ): UpgradeCandidate {
        const title = track.title || '';
        const artist = track.performer?.name || track.artist?.name || track.album?.artist?.name || '';
        const album = track.album?.title || '';
        const titleScore = this.similarity(this.normalizeString(sourceTitle), this.normalizeString(title));
        const artistScore = this.similarity(this.normalizeString(sourceArtist), this.normalizeString(artist));
        const albumScore = this.similarity(this.normalizeString(sourceAlbum), this.normalizeString(album));
        const variantWarning = this.hasDistinctVersionContext(
            { filePath: '', title: sourceTitle, album: sourceAlbum },
            { filePath: '', title, album }
        );
        const variantPenalty = variantWarning ? 0.12 : 0;

        return {
            trackId: String(track.id),
            title,
            artist,
            album,
            quality,
            qualityLabel: this.getQualityLabel(quality),
            albumId: track.album?.id ? String(track.album.id) : undefined,
            coverUrl: this.getBestCoverUrl(track.album?.image),
            duration: track.duration || undefined,
            releaseDate: this.getReleaseDate(track),
            matchScore: Math.max(
                0,
                Math.min(1, titleScore * 0.5 + artistScore * 0.3 + albumScore * 0.2 - variantPenalty)
            ),
            titleScore,
            artistScore,
            albumScore,
            variantWarning
        };
    }

    private dedupeUpgradeCandidates(candidates: UpgradeCandidate[]): UpgradeCandidate[] {
        const seen = new Set<string>();
        return candidates.filter((candidate) => {
            if (seen.has(candidate.trackId)) return false;
            seen.add(candidate.trackId);
            return true;
        });
    }

    private getBestCoverUrl(
        image?: NonNullable<UpgradeSearchTrack['album']>['image']
    ): string | undefined {
        if (!image) return undefined;
        return (
            image.extralarge ||
            image.mega ||
            image.large ||
            image.medium ||
            image.thumbnail ||
            image.small
        ) as string | undefined;
    }

    private getReleaseDate(track: UpgradeSearchTrack): string | undefined {
        const rawDate = track.album?.release_date_original || track.album?.release_date_download;
        if (rawDate) return rawDate;

        if (typeof track.album?.released_at === 'number' && track.album.released_at > 0) {
            return new Date(track.album.released_at * 1000).toISOString().slice(0, 10);
        }

        return undefined;
    }

    private async getHighestAvailableQuality(trackId: string | number): Promise<number | null> {
        const qualities = [27, 7, 6, 5];
        for (const quality of qualities) {
            try {
                const result = await this.api.getFileUrl(String(trackId), quality);
                if (result.success && result.data) {
                    const data = result.data as {
                        url?: string;
                        format_id?: number;
                        quality_verified?: boolean;
                        sample?: boolean;
                        duration?: number;
                    };
                    const formatId = data.format_id || 0;
                    if (!data.url || data.sample || (data.duration && data.duration <= 30)) {
                        continue;
                    }
                    if (quality >= 7 && data.quality_verified === false) {
                        logger.debug(
                            `Skipping unverified Hi-Res candidate ${trackId} for requested quality ${quality}`,
                            'SCANNER'
                        );
                        continue;
                    }
                    if (formatId && formatId >= quality) {
                        return formatId;
                    }
                    if (formatId && !qualities.includes(formatId)) {
                        return formatId;
                    }
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
        const files = databaseService.getLibraryFiles(100000, 0) as unknown as {
            file_path: string;
            audio_fingerprint?: string | null;
            title?: string | null;
            artist?: string | null;
            album?: string | null;
        }[];
        logger.debug(
            `[DUPLICATE_CHECK] Analyzing ${files.length} items for duplicates...`,
            'SCANNER'
        );

        const fingerprintGroups = new Map<string, string[]>();
        const titleGroups = new Map<string, { filePath: string; title: string; artist: string; album: string }[]>();

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
                    title: file.title || '',
                    artist: file.artist || '',
                    album: file.album || ''
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

                    if (this.hasDistinctVersionContext(item1, item2)) {
                        logger.debug(
                            `[DUPLICATE_CHECK] Skipped version/remix pair: ${path.basename(item1.filePath)} != ${path.basename(item2.filePath)}`,
                            'SCANNER'
                        );
                        continue;
                    }

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

    private hasDistinctVersionContext(
        item1: { filePath: string; title: string; album: string },
        item2: { filePath: string; title: string; album: string }
    ): boolean {
        const signature1 = this.getVersionSignature(item1);
        const signature2 = this.getVersionSignature(item2);

        if (!signature1.hasVariant && !signature2.hasVariant) return false;
        if (signature1.markers !== signature2.markers) return true;

        return Boolean(
            signature1.album &&
            signature2.album &&
            signature1.album !== signature2.album
        );
    }

    private getVersionSignature(item: { filePath: string; title: string; album: string }): {
        hasVariant: boolean;
        markers: string;
        album: string;
    } {
        const source = this.normalizeString(`${item.title} ${item.album} ${item.filePath}`);
        const variantMarkers: [string, RegExp][] = [
            ['remix', /\b(remix|rework|refix|mashup)\b/],
            ['featured', /\b(feat|ft|featuring|with)\b/],
            ['live', /\blive\b/],
            ['acoustic', /\bacoustic\b/],
            ['instrumental', /\b(instrumental|karaoke)\b/],
            ['edit', /\b(radio edit|single edit|edit)\b/],
            ['extended', /\b(extended|club|vip)\b/],
            ['demo', /\bdemo\b/],
            ['remaster', /\b(remaster|remastered)\b/],
            ['tempo', /\b(sped up|slowed|nightcore)\b/]
        ];

        const markers = variantMarkers
            .filter(([, pattern]) => pattern.test(source))
            .map(([marker]) => marker)
            .join('|');

        return {
            hasVariant: markers.length > 0,
            markers,
            album: this.normalizeString(item.album)
        };
    }

    private normalizeString(str: string): string {
        return str
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getDuplicates(): DuplicateGroup[] {
        const rawDuplicates = databaseService.getDuplicates() as unknown as { id: number; file_path_1: string; file_path_2: string; match_type: string }[];
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
                    matchType: dup.match_type as 'exact' | 'similar' | 'remaster',
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
        const files = databaseService.getUpgradeableFiles() as unknown as {
            file_path: string;
            track_id?: string | null;
            title?: string | null;
            artist?: string | null;
            album?: string | null;
            duration?: number | null;
            quality: number;
            available_quality?: number | null;
            upgrade_candidates?: string | null;
            file_size?: number | null;
            format?: string | null;
            bit_depth?: number | null;
            sample_rate?: number | null;
        }[];
        return files.map((f) => {
            const upgradeCandidates = this.parseUpgradeCandidates(f.upgrade_candidates);
            const fallbackCandidate =
                f.track_id && f.available_quality
                    ? [
                          {
                              trackId: f.track_id,
                              title: f.title || '',
                              artist: f.artist || '',
                              album: f.album || '',
                              quality: f.available_quality,
                              qualityLabel: this.getQualityLabel(f.available_quality),
                              matchScore: 1,
                              titleScore: 1,
                              artistScore: 1,
                              albumScore: 1,
                              variantWarning: false
                          }
                      ]
                    : [];

            return {
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
                needsUpgrade: true,
                upgradeCandidates: upgradeCandidates.length > 0 ? upgradeCandidates : fallbackCandidate
            };
        });
    }

    private parseUpgradeCandidates(value?: string | null): UpgradeCandidate[] {
        if (!value) return [];
        try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((candidate) => ({
                    trackId: String(candidate?.trackId || candidate?.track_id || ''),
                    title: String(candidate?.title || ''),
                    artist: String(candidate?.artist || ''),
                    album: String(candidate?.album || ''),
                    quality: Number(candidate?.quality || 0),
                    qualityLabel: String(
                        candidate?.qualityLabel || this.getQualityLabel(Number(candidate?.quality || 0))
                    ),
                    albumId: candidate?.albumId ? String(candidate.albumId) : undefined,
                    coverUrl: candidate?.coverUrl ? String(candidate.coverUrl) : undefined,
                    duration: candidate?.duration ? Number(candidate.duration) : undefined,
                    releaseDate: candidate?.releaseDate ? String(candidate.releaseDate) : undefined,
                    matchScore: Number(candidate?.matchScore || 0),
                    titleScore: Number(candidate?.titleScore || 0),
                    artistScore: Number(candidate?.artistScore || 0),
                    albumScore: Number(candidate?.albumScore || 0),
                    variantWarning: Boolean(candidate?.variantWarning)
                }))
                .filter((candidate) => candidate.trackId && candidate.quality > 0);
        } catch {
            return [];
        }
    }

    getMissingMetadataFiles(): LibraryFile[] {
        const files = databaseService.getMissingMetadataFiles() as unknown as {
            file_path: string;
            track_id?: string | null;
            title?: string | null;
            artist?: string | null;
            album?: string | null;
            duration?: number | null;
            quality: number;
            available_quality?: number | null;
            file_size?: number | null;
            format?: string | null;
            bit_depth?: number | null;
            sample_rate?: number | null;
            missing_tags?: string | null;
        }[];
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
        const duplicate = db.prepare('SELECT * FROM duplicates WHERE id = ?').get(id) as { file_path_1: string; file_path_2: string; match_type?: string } | undefined;
        if (!duplicate) return;
        if (duplicate.match_type !== 'exact') {
            databaseService.resolveDuplicate(id);
            logger.info(`Dismissed non-exact duplicate candidate #${id} without deleting files`, 'SCANNER');
            return;
        }

        const file1 = db
            .prepare('SELECT * FROM library_files WHERE file_path = ?')
            .get(duplicate.file_path_1) as { quality?: number; file_path: string; file_size?: number } | undefined;
        const file2 = db
            .prepare('SELECT * FROM library_files WHERE file_path = ?')
            .get(duplicate.file_path_2) as { quality?: number; file_path: string; file_size?: number } | undefined;
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
        } catch (err: unknown) {
            logger.error(
                `Failed to delete duplicate file ${fileToDelete}: ${(err as Error).message}`,
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
        } catch (error: unknown) {
            logger.error(`Failed to delete file: ${(error as Error).message}`, 'SCANNER');
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
        missingMetadata: number;
        totalSize: number;
        processedFiles?: number;
        currentFile?: string;
        FPCALC_AVAILABLE: boolean;
    } {
        const upgradeable = databaseService.getUpgradeableFiles();
        const duplicates = databaseService.getDuplicates();
        const db = databaseService.getDb();
        const totalRow = db
            .prepare('SELECT COUNT(*) as count, SUM(file_size) as size FROM library_files')
            .get() as { count: number; size: number } | undefined;
        const missingRow = db
            .prepare('SELECT COUNT(*) as count FROM library_files WHERE missing_metadata = 1')
            .get() as { count: number } | undefined;

        const stats = {
            totalFiles: totalRow?.count || 0,
            duplicates: duplicates.length,
            upgradeable: upgradeable.length,
            missingMetadata: missingRow?.count || 0,
            totalSize: totalRow?.size || 0,
            FPCALC_AVAILABLE: LibraryScannerService.fpcalcAvailable === true
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

    async findMissingTracks(): Promise<{ filePath: string; title: string; artist: string; album: string }[]> {
        const files = databaseService.getLibraryFiles(100000, 0) as unknown as {
            file_path: string;
            title?: string | null;
            artist?: string | null;
            album?: string | null;
        }[];
        const missing: { filePath: string; title: string; artist: string; album: string }[] = [];
        for (const file of files) {
            if (!fs.existsSync(file.file_path)) {
                missing.push({
                    filePath: file.file_path,
                    title: file.title || 'Unknown',
                    artist: file.artist || 'Unknown',
                    album: file.album || 'Unknown'
                });
            }
        }
        return missing;
    }
}

export const libraryScannerService = new LibraryScannerService();
export default libraryScannerService;
