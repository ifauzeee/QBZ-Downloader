import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

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
}

interface HistoryData {
    version: number;
    entries: Record<string, HistoryEntry>;
}

const HISTORY_VERSION = 1;
const DEFAULT_HISTORY_PATH = './data/history.json';

export class HistoryService {
    private entries: Map<string, HistoryEntry> = new Map();
    private filePath: string;
    private saveTimeout: NodeJS.Timeout | null = null;
    private isDirty: boolean = false;

    constructor(historyPath?: string) {
        this.filePath = historyPath || DEFAULT_HISTORY_PATH;
        this.load();
    }

    /**
     * Load history from JSON file
     */
    private load(): void {
        try {
            if (fs.existsSync(this.filePath)) {
                const content = fs.readFileSync(this.filePath, 'utf8');
                const data: HistoryData = JSON.parse(content);

                if (data.version === HISTORY_VERSION && data.entries) {
                    for (const [id, entry] of Object.entries(data.entries)) {
                        this.entries.set(id, entry);
                    }
                    logger.debug(`History: Loaded ${this.entries.size} entries`);
                }
            }
        } catch (error: any) {
            logger.warn(`History: Failed to load (${error.message}), starting fresh`);
        }
    }

    /**
     * Save history to JSON file (debounced)
     */
    private save(): void {
        this.isDirty = true;

        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.saveNow();
        }, 1000);
    }

    /**
     * Immediate save to file
     */
    private saveNow(): void {
        if (!this.isDirty) return;

        try {
            const dir = path.dirname(this.filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data: HistoryData = {
                version: HISTORY_VERSION,
                entries: Object.fromEntries(this.entries)
            };

            fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf8');
            this.isDirty = false;
            logger.debug(`History: Saved ${this.entries.size} entries`);
        } catch (error: any) {
            logger.error(`History: Failed to save (${error.message})`);
        }
    }

    /**
     * Check if track exists in history
     */
    has(trackId: string | number): boolean {
        return this.entries.has(trackId.toString());
    }

    /**
     * Get history entry by track ID
     */
    get(trackId: string | number): HistoryEntry | undefined {
        return this.entries.get(trackId.toString());
    }

    /**
     * Get all history entries
     */
    getAll(): Record<string, HistoryEntry> {
        const result: Record<string, HistoryEntry> = {};
        for (const [id, entry] of this.entries.entries()) {
            result[id] = entry;
        }
        return result;
    }

    /**
     * Get entries sorted by date (newest first)
     */
    getSorted(limit?: number): Array<{ id: string } & HistoryEntry> {
        const sorted = Array.from(this.entries.entries())
            .map(([id, entry]) => ({ id, ...entry }))
            .sort(
                (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
            );

        return limit ? sorted.slice(0, limit) : sorted;
    }

    /**
     * Add new entry to history
     */
    add(trackId: string | number, entry: Omit<HistoryEntry, 'downloadedAt'>): void {
        this.entries.set(trackId.toString(), {
            downloadedAt: new Date().toISOString(),
            ...entry
        });
        this.save();
    }

    /**
     * Remove entry from history
     */
    remove(trackId: string | number): boolean {
        const deleted = this.entries.delete(trackId.toString());
        if (deleted) {
            this.save();
        }
        return deleted;
    }

    /**
     * Clear all history entries
     */
    clearAll(): void {
        this.entries.clear();
        this.save();
    }

    /**
     * Get total count
     */
    count(): number {
        return this.entries.size;
    }

    /**
     * Search history by title or artist
     */
    search(query: string): Array<{ id: string } & HistoryEntry> {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.entries.entries())
            .filter(
                ([, entry]) =>
                    entry.title?.toLowerCase().includes(lowerQuery) ||
                    entry.artist?.toLowerCase().includes(lowerQuery) ||
                    entry.album?.toLowerCase().includes(lowerQuery)
            )
            .map(([id, entry]) => ({ id, ...entry }));
    }

    /**
     * Cleanup entries for files that no longer exist
     */
    cleanup(): number {
        let cleaned = 0;
        for (const [id, entry] of this.entries.entries()) {
            if (entry.filename && !fs.existsSync(entry.filename)) {
                this.entries.delete(id);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.save();
            logger.info(`History: Cleaned ${cleaned} entries with missing files`);
        }
        return cleaned;
    }

    /**
     * Force save (for graceful shutdown)
     */
    flush(): void {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveNow();
    }
}

export const historyService = new HistoryService();
