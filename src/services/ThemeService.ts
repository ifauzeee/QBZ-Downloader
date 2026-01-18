import { databaseService } from './database/index.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

export interface Theme {
    id: string;
    name: string;
    is_dark: boolean;
    colors: Record<string, string>;
    created_at: string;
    updated_at: string;
}

class ThemeService {
    async create(name: string, isDark: boolean, colors: Record<string, string>): Promise<Theme> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const db = databaseService.getDb();

        db.prepare(
            `
            INSERT INTO themes (id, name, is_dark, colors, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(id, name, isDark ? 1 : 0, JSON.stringify(colors), now, now);

        logger.info(`Theme created: ${name}`, 'THEME');

        return {
            id,
            name,
            is_dark: isDark,
            colors,
            created_at: now,
            updated_at: now
        };
    }

    async update(
        id: string,
        name: string,
        isDark: boolean,
        colors: Record<string, string>
    ): Promise<Theme | null> {
        const db = databaseService.getDb();
        const now = new Date().toISOString();

        const result = db
            .prepare(
                `
            UPDATE themes 
            SET name = ?, is_dark = ?, colors = ?, updated_at = ?
            WHERE id = ?
        `
            )
            .run(name, isDark ? 1 : 0, JSON.stringify(colors), now, id);

        if (result.changes === 0) return null;

        return {
            id,
            name,
            is_dark: isDark,
            colors,
            created_at: '',
            updated_at: now
        };
    }

    async delete(id: string): Promise<boolean> {
        const db = databaseService.getDb();
        const result = db.prepare('DELETE FROM themes WHERE id = ?').run(id);
        return result.changes > 0;
    }

    async getAll(): Promise<Theme[]> {
        const db = databaseService.getDb();
        const rows = db.prepare('SELECT * FROM themes ORDER BY created_at DESC').all() as any[];

        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            is_dark: row.is_dark === 1,
            colors: JSON.parse(row.colors),
            created_at: row.created_at,
            updated_at: row.updated_at
        }));
    }

    async get(id: string): Promise<Theme | null> {
        const db = databaseService.getDb();
        const row = db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as any;

        if (!row) return null;

        return {
            id: row.id,
            name: row.name,
            is_dark: row.is_dark === 1,
            colors: JSON.parse(row.colors),
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }
}

export const themeService = new ThemeService();
