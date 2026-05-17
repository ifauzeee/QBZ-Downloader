import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { databaseService, DbTrack } from './database/index.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { aiMetadataService } from './AIMetadataService.js';

export interface HealingReport {
    scanned: number;
    fixed: number;
    missing: number;
    upgraded: number;
    details: string[];
}

export class LibraryHealerService {
    async performFullHeal(): Promise<HealingReport> {
        const report: HealingReport = {
            scanned: 0,
            fixed: 0,
            missing: 0,
            upgraded: 0,
            details: []
        };

        const tracks = databaseService.getAllTracks();
        report.scanned = tracks.length;

        logger.info(`LibraryHealer: Starting scan of ${tracks.length} tracks...`, 'HEALER');

        for (const track of tracks) {
            await this.healTrack(track, report);
        }

        logger.success(
            `LibraryHealer: Scan complete. Fixed: ${report.fixed}, Missing: ${report.missing}`,
            'HEALER'
        );
        return report;
    }

    private async healTrack(track: DbTrack, report: HealingReport) {
        let exists = false;
        try {
            await fs.access(track.file_path);
            exists = true;
        } catch {
            exists = false;
        }

        if (!exists) {
            const foundPath = await this.searchForFile(path.basename(track.file_path));
            if (foundPath) {
                databaseService.updateTrackPath(track.id, foundPath);
                report.fixed++;
                report.details.push(`Relocated: ${track.title} -> ${foundPath}`);
                return;
            } else {
                report.missing++;
                report.details.push(`Missing: ${track.title} (Expected: ${track.file_path})`);
            }
        }

        if (CONFIG.ai.enabled && (!track.genre || track.genre === 'Unknown')) {
            const repaired = await aiMetadataService.repairMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album
            });

            if (repaired && repaired.genre) {
                databaseService.updateTrackMetadata(track.id, { genre: repaired.genre });
                report.fixed++;
                report.details.push(`Repaired Tags: ${track.title} (${repaired.genre})`);
            }
        }
    }

    private async searchForFile(filename: string, maxDepth: number = 10): Promise<string | null> {
        const root = CONFIG.download.outputDir;
        if (!existsSync(root)) return null;

        return this.recursiveSearch(root, filename, 0, maxDepth);
    }

    private async recursiveSearch(
        dir: string,
        target: string,
        depth: number = 0,
        maxDepth: number = 10
    ): Promise<string | null> {
        if (depth > maxDepth) {
            logger.debug(`Max search depth (${maxDepth}) reached at: ${dir}`, 'HEALER');
            return null;
        }

        try {
            const files = await fs.readdir(dir);
            for (const file of files) {
                const fullPath = path.join(dir, file);

                let stats: Awaited<ReturnType<typeof fs.lstat>>;
                try {
                    stats = await fs.lstat(fullPath);
                } catch {
                    continue;
                }

                if (stats.isDirectory() && !stats.isSymbolicLink()) {
                    const found = await this.recursiveSearch(fullPath, target, depth + 1, maxDepth);
                    if (found) return found;
                } else if (file === target) {
                    return fullPath;
                }
            }
        } catch (err) {
            logger.error(`Error searching in ${dir}: ${err}`, 'HEALER');
        }
        return null;
    }
}

export const libraryHealerService = new LibraryHealerService();
