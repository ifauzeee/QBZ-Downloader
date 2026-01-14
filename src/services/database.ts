import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'qbz.db');

export class DatabaseService {
    private db: DatabaseSync;

    constructor() {
        try {
            this.db = new DatabaseSync(DB_PATH);
            this.initSchema();
            logger.info(`Database connected: ${DB_PATH}`);
        } catch (error) {
            logger.error(`Failed to initialize database: ${error}`);
            throw error;
        }
    }

    private initSchema() {
        this.db.exec('PRAGMA journal_mode = WAL;');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS history (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT,
                album TEXT,
                quality INTEGER,
                filepath TEXT,
                downloaded_at TEXT,
                metadata JSON
            );
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS queue (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content_id TEXT NOT NULL,
                quality INTEGER,
                status TEXT NOT NULL,
                title TEXT,
                added_at TEXT,
                priority TEXT
            );
        `);
    }

    addToHistory(entry: {
        id: string;
        title: string;
        quality: number;
        filepath: string;
        artist?: string;
        album?: string;
        metadata?: any;
    }) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO history (id, title, artist, album, quality, filepath, downloaded_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            entry.id,
            entry.title,
            entry.artist || null,
            entry.album || null,
            entry.quality,
            entry.filepath,
            new Date().toISOString(),
            JSON.stringify(entry.metadata || {})
        );
    }

    getHistory(id: string) {
        const stmt = this.db.prepare('SELECT * FROM history WHERE id = ?');
        const result = stmt.get(id) as any;
        if (result && result.metadata) {
            result.metadata = JSON.parse(result.metadata);
        }
        return result;
    }

    getAllHistory() {
        const stmt = this.db.prepare('SELECT * FROM history ORDER BY downloaded_at DESC');
        return stmt.all().map((row: any) => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
        }));
    }

    saveQueueItem(item: {
        id: string;
        type: string;
        contentId: string | number;
        quality: number;
        status: string;
        title?: string;
        priority?: string;
    }) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO queue (id, type, content_id, quality, status, title, added_at, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            item.id,
            item.type,
            item.contentId.toString(),
            item.quality,
            item.status,
            item.title || null,
            new Date().toISOString(),
            item.priority || 'normal'
        );
    }

    updateQueueStatus(id: string, status: string) {
        const stmt = this.db.prepare('UPDATE queue SET status = ? WHERE id = ?');
        stmt.run(status, id);
    }

    removeQueueItem(id: string) {
        const stmt = this.db.prepare('DELETE FROM queue WHERE id = ?');
        stmt.run(id);
    }

    getPendingQueue() {
        const stmt = this.db.prepare(
            'SELECT * FROM queue WHERE status = \'pending\' ORDER BY added_at ASC'
        );
        return stmt.all().map((row: any) => ({
            id: row.id,
            type: row.type,
            contentId: row.content_id,
            quality: row.quality,
            status: row.status,
            title: row.title,
            priority: row.priority
        }));
    }

    clearQueue() {
        this.db.exec('DELETE FROM queue');
    }
}

export const db = new DatabaseService();
