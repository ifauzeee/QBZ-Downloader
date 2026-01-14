import fs from 'fs';
import path from 'path';
import { db } from './database.js';
import { logger } from '../utils/logger.js';

interface HistoryEntry {
    downloadedAt: string;
    filename: string;
    quality: number;
    title: string;
}

export class HistoryService {
    private historyFile: string;

    constructor(filePath: string = 'history.json') {
        this.historyFile = path.resolve(filePath);
        this.migrateFromJson();
    }

    private migrateFromJson() {
        if (fs.existsSync(this.historyFile)) {
            try {
                const currentHistory = db.getAllHistory();
                if (currentHistory.length === 0) {
                    logger.info('Migrating history.json to SQLite database...');
                    const content = fs.readFileSync(this.historyFile, 'utf-8');
                    const data = JSON.parse(content);

                    if (data.tracks) {
                        let count = 0;
                        for (const [id, entry] of Object.entries(data.tracks)) {
                            db.addToHistory({
                                id,
                                title: (entry as any).title,
                                quality: (entry as any).quality,
                                filepath: (entry as any).filename
                            });
                            count++;
                        }
                        logger.success(`Migrated ${count} history entries to database.`);

                        fs.renameSync(this.historyFile, `${this.historyFile}.bak`);
                    }
                }
            } catch (error) {
                logger.error(`Migration failed: ${error}`);
            }
        }
    }

    has(trackId: string | number): boolean {
        const result = db.getHistory(trackId.toString());
        return !!result;
    }

    get(trackId: string | number): HistoryEntry | undefined {
        const result = db.getHistory(trackId.toString());
        if (!result) return undefined;

        return {
            downloadedAt: result.downloaded_at,
            filename: result.filepath,
            quality: result.quality,
            title: result.title
        };
    }

    getAll(): Record<string, HistoryEntry> {
        const rows = db.getAllHistory();
        const result: Record<string, HistoryEntry> = {};

        for (const row of rows) {
            result[row.id] = {
                downloadedAt: row.downloaded_at,
                filename: row.filepath,
                quality: row.quality,
                title: row.title
            };
        }
        return result;
    }

    add(trackId: string | number, entry: Omit<HistoryEntry, 'downloadedAt'>) {
        db.addToHistory({
            id: trackId.toString(),
            title: entry.title,
            quality: entry.quality,
            filepath: entry.filename
        });
    }
}

export const historyService = new HistoryService();
