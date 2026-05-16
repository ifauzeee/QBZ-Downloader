import fs from 'fs';
import { logger } from '../utils/logger.js';
import { databaseService } from './database/index.js';

export interface HistoryEntry {
    downloadedAt: string;
    filename: string;
    quality: number;
    title: string;
    artist?: string;
    albumArtist?: string;
    artistImageUrl?: string;
    album?: string;
    type?: 'track' | 'album' | 'playlist' | 'artist';
    qualityScan?: {
        isTrueLossless: boolean;
        confidence: number;
        details: string;
    };
}

const DEFAULT_HISTORY_PATH = './data/history.json';

export class HistoryService {
    private jsonPath: string;

    constructor(historyPath?: string) {
        this.jsonPath = historyPath || DEFAULT_HISTORY_PATH;
        this.migrateFromJson();
    }

    private migrateFromJson(): void {
        try {
            if (fs.existsSync(this.jsonPath)) {
                const content = fs.readFileSync(this.jsonPath, 'utf8');
                const data = JSON.parse(content);

                if (data.entries && Object.keys(data.entries).length > 0) {
                    logger.info(`History: Migrating ${Object.keys(data.entries).length} entries to SQLite...`, 'HISTORY');
                    for (const [id, entry] of Object.entries(data.entries)) {
                        databaseService.addHistoryEntry(id, entry);
                    }
                    
                    // Backup and remove JSON
                    const backupPath = this.jsonPath + '.bak';
                    fs.renameSync(this.jsonPath, backupPath);
                    logger.success(`History: Migration complete. JSON backed up to ${backupPath}`, 'HISTORY');
                }
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.warn(`History: Migration failed (${message})`);
        }
    }

    has(trackId: string | number): boolean {
        return !!databaseService.getHistory(trackId.toString());
    }

    get(trackId: string | number): HistoryEntry | undefined {
        return databaseService.getHistory(trackId.toString());
    }

    getAll(): Record<string, HistoryEntry> {
        return databaseService.getHistoryAll();
    }

    getSorted(limit?: number): Array<{ id: string } & HistoryEntry> {
        return databaseService.getHistorySorted(limit);
    }

    add(trackId: string | number, entry: Omit<HistoryEntry, 'downloadedAt'>): void {
        databaseService.addHistoryEntry(trackId.toString(), {
            downloadedAt: new Date().toISOString(),
            ...entry
        });
    }

    remove(trackId: string | number): boolean {
        return databaseService.removeHistoryEntry(trackId.toString());
    }

    clearAll(): void {
        databaseService.clearHistory();
    }

    count(): number {
        const all = databaseService.getHistoryAll();
        return Object.keys(all).length;
    }

    search(query: string): Array<{ id: string } & HistoryEntry> {
        return databaseService.searchHistory(query);
    }

    cleanup(): number {
        let cleaned = 0;
        const all = databaseService.getHistoryAll();
        for (const [id, entry] of Object.entries(all)) {
            if (entry.filename && !fs.existsSync(entry.filename)) {
                databaseService.removeHistoryEntry(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info(`History: Cleaned ${cleaned} entries with missing files`);
        }
        return cleaned;
    }

    flush(): void {
        // No-op for SQLite
    }
}

export const historyService = new HistoryService();
