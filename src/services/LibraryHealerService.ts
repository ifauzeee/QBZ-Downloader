import { existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { databaseService } from './database/index.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { aiMetadataService } from './AIMetadataService.js';
import { downloadQueue } from './queue/queue.js';

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

        logger.success(`LibraryHealer: Scan complete. Fixed: ${report.fixed}, Missing: ${report.missing}`, 'HEALER');
        return report;
    }

    private async healTrack(track: any, report: HealingReport) {
        if (!existsSync(track.file_path)) {
            const foundPath = this.searchForFile(path.basename(track.file_path));
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

    private searchForFile(filename: string): string | null {
        const root = CONFIG.download.outputDir;
        if (!existsSync(root)) return null;

        return this.recursiveSearch(root, filename);
    }

    private recursiveSearch(dir: string, target: string): string | null {
        const files = readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (statSync(fullPath).isDirectory()) {
                const found = this.recursiveSearch(fullPath, target);
                if (found) return found;
            } else if (file === target) {
                return fullPath;
            }
        }
        return null;
    }
}

export const libraryHealerService = new LibraryHealerService();
