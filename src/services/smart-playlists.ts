import crypto from 'crypto';
import { databaseService, type DbTrack } from './database/index.js';

export interface SmartPlaylistFilter {
    q?: string;
    genre?: string;
    artist?: string;
    album?: string;
    minQuality?: number;
}

export interface SmartPlaylist {
    id: string;
    name: string;
    filter: string;
    created_at: string;
}

export interface SmartPlaylistRow extends SmartPlaylist {
    track_count: number;
}

const escapeLikePattern = (value: string): string =>
    value.replace(/[\\%_]/g, (c) => `\\${c}`);

export function sanitizeSmartPlaylistFilter(
    input: unknown
): SmartPlaylistFilter | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

    const src = input as Record<string, unknown>;
    const filter: SmartPlaylistFilter = {};

    const str = (key: keyof SmartPlaylistFilter) => {
        const value = src[key];
        if (typeof value === 'string' && value.trim() !== '') {
            (filter as Record<string, string>)[key] = value.trim();
        }
    };

    str('q');
    str('genre');
    str('artist');
    str('album');

    const minQuality = Number(src.minQuality);
    if (Number.isFinite(minQuality) && minQuality > 0) {
        filter.minQuality = minQuality;
    }

    return Object.keys(filter).length > 0 ? filter : null;
}

export function buildTrackFilterSql(filter: SmartPlaylistFilter): {
    sql: string;
    params: (string | number)[];
} {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (filter.q) {
        clauses.push("(title LIKE ? ESCAPE '\\' OR artist LIKE ? ESCAPE '\\' OR album LIKE ? ESCAPE '\\')");
        const like = `%${escapeLikePattern(filter.q)}%`;
        params.push(like, like, like);
    }
    if (filter.genre) {
        clauses.push('genre = ?');
        params.push(filter.genre);
    }
    if (filter.artist) {
        clauses.push('artist LIKE ? ESCAPE \'\\\'');
        params.push(`%${escapeLikePattern(filter.artist)}%`);
    }
    if (filter.album) {
        clauses.push('album LIKE ? ESCAPE \'\\\'');
        params.push(`%${escapeLikePattern(filter.album)}%`);
    }
    if (typeof filter.minQuality === 'number') {
        clauses.push('quality >= ?');
        params.push(filter.minQuality);
    }

    return {
        sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
        params
    };
}

export function listSmartPlaylists(): SmartPlaylistRow[] {
    const db = databaseService.getDb();
    const rows = db
        .prepare('SELECT * FROM smart_playlists ORDER BY created_at DESC')
        .all() as SmartPlaylist[];
    return rows.map((row) => {
        const filter = parseSmartPlaylistFilter(row);
        return {
            ...row,
            track_count: filter ? countTracksForFilter(filter) : 0
        };
    });
}

export function createSmartPlaylist(name: string, filter: SmartPlaylistFilter): SmartPlaylist {
    const db = databaseService.getDb();
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO smart_playlists (id, name, filter) VALUES (?, ?, ?)').run(
        id,
        name,
        JSON.stringify(filter)
    );
    return { id, name, filter: JSON.stringify(filter), created_at: '' };
}

export function deleteSmartPlaylist(id: string): boolean {
    const db = databaseService.getDb();
    return db.prepare('DELETE FROM smart_playlists WHERE id = ?').run(id).changes > 0;
}

export function parseSmartPlaylistFilter(row: SmartPlaylist | undefined): SmartPlaylistFilter | undefined {
    if (!row) return undefined;
    try {
        return sanitizeSmartPlaylistFilter(JSON.parse(row.filter)) ?? undefined;
    } catch {
        return undefined;
    }
}

export function getSmartPlaylist(id: string): SmartPlaylist | undefined {
    const db = databaseService.getDb();
    return db.prepare('SELECT * FROM smart_playlists WHERE id = ?').get(id) as
        | SmartPlaylist
        | undefined;
}

export function countTracksForFilter(filter: SmartPlaylistFilter): number {
    const db = databaseService.getDb();
    const { sql, params } = buildTrackFilterSql(filter);
    const row = db
        .prepare(`SELECT COUNT(*) AS count FROM tracks ${sql}`)
        .get(...params) as { count: number };
    return row.count;
}

export function tracksForFilter(filter: SmartPlaylistFilter, limit = 500): DbTrack[] {
    const db = databaseService.getDb();
    const { sql, params } = buildTrackFilterSql(filter);
    return db
        .prepare(`SELECT * FROM tracks ${sql} ORDER BY downloaded_at DESC LIMIT ?`)
        .all(...params, limit) as DbTrack[];
}