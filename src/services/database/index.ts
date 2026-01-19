import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

const DB_VERSION = 9;
const DEFAULT_DB_PATH = './data/qbz.db';

export interface DbTrack {
    id: string;
    title: string;
    artist: string;
    album_artist: string;
    album: string;
    album_id: string;
    duration: number;
    quality: number;
    file_path: string;
    file_size: number;
    cover_url: string;
    downloaded_at: string;
    genre: string;
    year: number;
    isrc: string;
    label: string;
}

export interface DbAlbum {
    id: string;
    title: string;
    artist: string;
    artist_id: string;
    cover_url: string;
    track_count: number;
    release_date: string;
    genre: string;
    label: string;
    downloaded_at: string;
    quality: number;
    total_size: number;
    folder_path: string;
}

export interface DbStatistic {
    id: number;
    date: string;
    downloads: number;
    tracks: number;
    albums: number;
    playlists: number;
    total_size: number;
    avg_quality: number;
}

export interface DbPluginConfig {
    id: string;
    name: string;
    enabled: boolean;
    config: string;
    version: string;
    installed_at: string;
}

class DatabaseService {
    private db: Database.Database | null = null;
    private dbPath: string;
    private initialized = false;

    constructor(dbPath?: string) {
        this.dbPath = dbPath || DEFAULT_DB_PATH;
    }

    initialize(): void {
        if (this.initialized) return;

        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            this.db = new Database(this.dbPath);
            const journalMode = process.env.SQLITE_JOURNAL_MODE || 'WAL';
            this.db.pragma(`journal_mode = ${journalMode}`);
            this.db.pragma('foreign_keys = ON');

            this.createSchema();
            this.runMigrations();

            this.initialized = true;
            logger.success(`Database initialized: ${this.dbPath}`, 'DB');
        } catch (error: any) {
            logger.error(`Database init failed: ${error.message}`, 'DB');
            throw error;
        }
    }

    private createSchema(): void {
        if (!this.db) return;

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT,
                album_artist TEXT,
                album TEXT,
                album_id TEXT,
                duration INTEGER DEFAULT 0,
                quality INTEGER DEFAULT 27,
                file_path TEXT,
                file_size INTEGER DEFAULT 0,
                cover_url TEXT,
                downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                genre TEXT,
                year INTEGER,
                isrc TEXT,
                label TEXT,
                play_count INTEGER DEFAULT 0,
                last_played TEXT,
                checksum TEXT,
                verification_status TEXT DEFAULT 'pending'
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS albums (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                artist TEXT,
                artist_id TEXT,
                cover_url TEXT,
                track_count INTEGER DEFAULT 0,
                release_date TEXT,
                genre TEXT,
                label TEXT,
                downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
                quality INTEGER DEFAULT 27,
                total_size INTEGER DEFAULT 0,
                folder_path TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS artists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                image_url TEXT,
                album_count INTEGER DEFAULT 0,
                track_count INTEGER DEFAULT 0,
                first_download TEXT DEFAULT CURRENT_TIMESTAMP,
                last_download TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS daily_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT UNIQUE NOT NULL,
                downloads INTEGER DEFAULT 0,
                tracks INTEGER DEFAULT 0,
                albums INTEGER DEFAULT 0,
                playlists INTEGER DEFAULT 0,
                total_size INTEGER DEFAULT 0,
                avg_quality REAL DEFAULT 0,
                listening_time INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS hourly_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                datetime TEXT UNIQUE NOT NULL,
                downloads INTEGER DEFAULT 0,
                bytes_downloaded INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS genre_stats (
                genre TEXT PRIMARY KEY,
                count INTEGER DEFAULT 0,
                total_size INTEGER DEFAULT 0,
                last_download TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS quality_stats (
                quality INTEGER PRIMARY KEY,
                count INTEGER DEFAULT 0,
                total_size INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS plugins (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                config TEXT DEFAULT '{}',
                version TEXT,
                installed_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS plugin_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plugin_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (plugin_id) REFERENCES plugins(id)
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS library_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                track_id TEXT,
                title TEXT,
                artist TEXT,
                album_artist TEXT,
                album TEXT,
                duration INTEGER,
                quality INTEGER,
                available_quality INTEGER,
                file_size INTEGER,
                format TEXT,
                bit_depth INTEGER,
                sample_rate INTEGER,
                scanned_at TEXT DEFAULT CURRENT_TIMESTAMP,
                needs_upgrade INTEGER DEFAULT 0,
                checksum TEXT,
                verification_status TEXT DEFAULT 'pending'
            )
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS duplicates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path_1 TEXT NOT NULL,
                file_path_2 TEXT NOT NULL,
                match_type TEXT,
                confidence REAL,
                detected_at TEXT DEFAULT CURRENT_TIMESTAMP,
                resolved INTEGER DEFAULT 0
            )
        `);

        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
            CREATE INDEX IF NOT EXISTS idx_tracks_downloaded ON tracks(downloaded_at);
            CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist);
            CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date);
            CREATE INDEX IF NOT EXISTS idx_library_artist ON library_files(artist);
            CREATE INDEX IF NOT EXISTS idx_library_album ON library_files(album);

            CREATE TABLE IF NOT EXISTS queue_items (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                content_id TEXT NOT NULL,
                quality INTEGER NOT NULL,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                progress REAL DEFAULT 0,
                title TEXT,
                artist_data TEXT,
                album_data TEXT,
                error TEXT,
                file_path TEXT,
                added_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                retry_count INTEGER DEFAULT 0,
                max_retries INTEGER DEFAULT 3,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS watched_playlists (
                id TEXT PRIMARY KEY,
                playlist_id TEXT NOT NULL,
                title TEXT,
                quality INTEGER DEFAULT 27,
                interval_hours INTEGER DEFAULT 24,
                last_synced_at TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS themes (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                is_dark INTEGER DEFAULT 1,
                colors TEXT NOT NULL, -- JSON string of CSS variables
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT
            );
        `);

        try {
            const tableInfo = this.db!.prepare('PRAGMA table_info(library_files)').all() as {
                name: string;
            }[];
            const hasFingerprint = tableInfo.some((col) => col.name === 'audio_fingerprint');
            if (!hasFingerprint) {
                this.db!.exec('ALTER TABLE library_files ADD COLUMN audio_fingerprint TEXT');
                logger.info('Migration: Added audio_fingerprint to library_files', 'DB');
            }
        } catch (error: any) {
            logger.warn(`Migration fingerprint error: ${error.message}`, 'DB');
        }

        logger.debug('Database schema created', 'DB');
    }

    private runMigrations(): void {
        if (!this.db) return;

        const stmt = this.db.prepare('SELECT value FROM meta WHERE key = ?');
        const row = stmt.get('db_version') as { value: string } | undefined;
        const currentVersion = row ? parseInt(row.value) : 0;

        if (currentVersion < 2) {
            try {
                const tableInfo = this.db.prepare('PRAGMA table_info(tracks)').all() as {
                    name: string;
                }[];
                const hasAlbumArtist = tableInfo.some((col) => col.name === 'album_artist');

                if (!hasAlbumArtist) {
                    this.db.exec('ALTER TABLE tracks ADD COLUMN album_artist TEXT');
                    this.db.exec(
                        'UPDATE tracks SET album_artist = artist WHERE album_artist IS NULL'
                    );
                    logger.info('Migration: Added album_artist column to tracks table', 'DB');
                }
            } catch (error: any) {
                logger.warn(`Migration v2 partial: ${error.message}`, 'DB');
            }
        }

        if (currentVersion < 3) {
            try {
                const tableInfo = this.db.prepare('PRAGMA table_info(library_files)').all() as {
                    name: string;
                }[];
                const hasAvailableQuality = tableInfo.some(
                    (col) => col.name === 'available_quality'
                );

                if (!hasAvailableQuality) {
                    this.db.exec('ALTER TABLE library_files ADD COLUMN available_quality INTEGER');
                    logger.info(
                        'Migration: Added available_quality column to library_files table',
                        'DB'
                    );
                }
            } catch (error: any) {
                logger.warn(`Migration v3 partial: ${error.message}`, 'DB');
            }
        }

        if (currentVersion < DB_VERSION) {
            if (currentVersion < 7) {
                try {
                    const tableInfo = this.db!.prepare(
                        'PRAGMA table_info(library_files)'
                    ).all() as { name: string }[];
                    const hasMissingMeta = tableInfo.some((col) => col.name === 'missing_metadata');
                    if (!hasMissingMeta) {
                        this.db!.exec(
                            'ALTER TABLE library_files ADD COLUMN missing_metadata INTEGER DEFAULT 0'
                        );
                        logger.info('Migration v7: Added missing_metadata column', 'DB');
                    }
                } catch (error: any) {
                    logger.warn(`Migration v7 partial: ${error.message}`, 'DB');
                }
            }

            if (currentVersion < 8) {
                try {
                    const tableInfo = this.db!.prepare(
                        'PRAGMA table_info(library_files)'
                    ).all() as { name: string }[];
                    const hasAlbumArtist = tableInfo.some((col) => col.name === 'album_artist');
                    if (!hasAlbumArtist) {
                        this.db!.exec('ALTER TABLE library_files ADD COLUMN album_artist TEXT');
                        logger.info(
                            'Migration v8: Added album_artist column to library_files',
                            'DB'
                        );
                    }
                } catch (error: any) {
                    logger.warn(`Migration v8 partial: ${error.message}`, 'DB');
                }
            }

            if (currentVersion < 9) {
                try {
                    const tableInfo = this.db!.prepare(
                        'PRAGMA table_info(library_files)'
                    ).all() as { name: string }[];
                    const hasMissingTags = tableInfo.some((col) => col.name === 'missing_tags');
                    if (!hasMissingTags) {
                        this.db!.exec('ALTER TABLE library_files ADD COLUMN missing_tags TEXT');
                        logger.info(
                            'Migration v9: Added missing_tags column to library_files',
                            'DB'
                        );
                    }
                } catch (error: any) {
                    logger.warn(`Migration v9 partial: ${error.message}`, 'DB');
                }
            }

            this.db
                .prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)')
                .run('db_version', String(9));
            logger.info(`Database migrated to version ${9}`, 'DB');
        }
    }

    getDb(): Database.Database {
        if (!this.db) {
            this.initialize();
        }
        return this.db!;
    }

    close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.initialized = false;
            logger.debug('Database connection closed', 'DB');
        }
    }

    addTrack(track: Partial<DbTrack>): void {
        const db = this.getDb();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO tracks 
            (id, title, artist, album_artist, album, album_id, duration, quality, file_path, file_size, cover_url, genre, year, isrc, label, downloaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            track.id,
            track.title,
            track.artist,
            track.album_artist || track.artist,
            track.album,
            track.album_id,
            track.duration || 0,
            track.quality || 27,
            track.file_path,
            track.file_size || 0,
            track.cover_url,
            track.genre,
            track.year,
            track.isrc,
            track.label,
            track.downloaded_at || new Date().toISOString()
        );

        this.updateDailyStats('tracks');
        if (track.genre) this.updateGenreStats(track.genre, track.file_size || 0);
        if (track.quality) this.updateQualityStats(track.quality, track.file_size || 0);
        const artistForStats = track.album_artist || track.artist;
        if (artistForStats) this.updateArtistStats(artistForStats);
    }

    getTrack(id: string): DbTrack | undefined {
        const db = this.getDb();
        return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as DbTrack | undefined;
    }

    getAllTracks(limit = 100, offset = 0): DbTrack[] {
        const db = this.getDb();
        return db
            .prepare('SELECT * FROM tracks ORDER BY downloaded_at DESC LIMIT ? OFFSET ?')
            .all(limit, offset) as DbTrack[];
    }

    searchTracks(query: string): DbTrack[] {
        const db = this.getDb();
        const searchQuery = `%${query}%`;
        return db
            .prepare(
                'SELECT * FROM tracks WHERE title LIKE ? OR artist LIKE ? OR album LIKE ? ORDER BY downloaded_at DESC LIMIT 100'
            )
            .all(searchQuery, searchQuery, searchQuery) as DbTrack[];
    }

    getTrackCount(): number {
        const db = this.getDb();
        const row = db.prepare('SELECT COUNT(*) as count FROM tracks').get() as { count: number };
        return row.count;
    }

    hasTrack(id: string): boolean {
        const db = this.getDb();
        const row = db.prepare('SELECT 1 FROM tracks WHERE id = ?').get(id);
        return !!row;
    }

    addAlbum(album: Partial<DbAlbum>): void {
        const db = this.getDb();
        const stmt = db.prepare(`
            INSERT OR REPLACE INTO albums 
            (id, title, artist, artist_id, cover_url, track_count, release_date, genre, label, quality, total_size, folder_path, downloaded_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            album.id,
            album.title,
            album.artist,
            album.artist_id,
            album.cover_url,
            album.track_count || 0,
            album.release_date,
            album.genre,
            album.label,
            album.quality || 27,
            album.total_size || 0,
            album.folder_path,
            album.downloaded_at || new Date().toISOString()
        );

        this.updateDailyStats('albums');
    }

    getAlbum(id: string): DbAlbum | undefined {
        const db = this.getDb();
        return db.prepare('SELECT * FROM albums WHERE id = ?').get(id) as DbAlbum | undefined;
    }

    getAllAlbums(limit = 50, offset = 0): DbAlbum[] {
        const db = this.getDb();
        return db
            .prepare('SELECT * FROM albums ORDER BY downloaded_at DESC LIMIT ? OFFSET ?')
            .all(limit, offset) as DbAlbum[];
    }

    private updateDailyStats(type: 'tracks' | 'albums' | 'playlists', size = 0): void {
        const db = this.getDb();
        const today = new Date().toISOString().split('T')[0];

        db.prepare(
            `
            INSERT INTO daily_stats (date, downloads, ${type}, total_size)
            VALUES (?, 1, 1, ?)
            ON CONFLICT(date) DO UPDATE SET
                downloads = downloads + 1,
                ${type} = ${type} + 1,
                total_size = total_size + ?
        `
        ).run(today, size, size);
    }

    private updateGenreStats(genre: string, size: number): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT INTO genre_stats (genre, count, total_size, last_download)
            VALUES (?, 1, ?, ?)
            ON CONFLICT(genre) DO UPDATE SET
                count = count + 1,
                total_size = total_size + ?,
                last_download = ?
        `
        ).run(genre, size, new Date().toISOString(), size, new Date().toISOString());
    }

    private updateQualityStats(quality: number, size: number): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT INTO quality_stats (quality, count, total_size)
            VALUES (?, 1, ?)
            ON CONFLICT(quality) DO UPDATE SET
                count = count + 1,
                total_size = total_size + ?
        `
        ).run(quality, size, size);
    }

    private updateArtistStats(artistName: string, imageUrl?: string): void {
        const db = this.getDb();
        const now = new Date().toISOString();
        db.prepare(
            `
            INSERT INTO artists (id, name, image_url, track_count, first_download, last_download)
            VALUES (?, ?, ?, 1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                track_count = track_count + 1,
                last_download = ?
        `
        ).run(
            artistName.toLowerCase().replace(/\s+/g, '-'),
            artistName,
            imageUrl || null,
            now,
            now,
            now
        );
    }

    getDailyStats(days = 30): DbStatistic[] {
        const db = this.getDb();
        return db
            .prepare('SELECT * FROM daily_stats ORDER BY date DESC LIMIT ?')
            .all(days) as DbStatistic[];
    }

    getGenreStats(limit = 5): { genre: string; count: number; total_size: number }[] {
        const db = this.getDb();
        return db.prepare('SELECT * FROM genre_stats ORDER BY count DESC LIMIT ?').all(limit) as {
            genre: string;
            count: number;
            total_size: number;
        }[];
    }

    getQualityStats(): { quality: number; count: number; total_size: number }[] {
        const db = this.getDb();
        return db.prepare('SELECT * FROM quality_stats ORDER BY quality DESC').all() as {
            quality: number;
            count: number;
            total_size: number;
        }[];
    }

    getTopArtists(limit = 5): any[] {
        const db = this.getDb();
        return db
            .prepare(
                `SELECT 
                    MAX(COALESCE(album_artist, artist)) as name, 
                    COUNT(*) as track_count,
                    COUNT(DISTINCT album) as album_count,
                    SUM(file_size) as total_size,
                    AVG(quality) as avg_quality,
                    MIN(scanned_at) as first_download,
                    MAX(scanned_at) as last_download
                FROM library_files 
                GROUP BY COALESCE(album_artist, artist)
                ORDER BY track_count DESC 
                LIMIT ?`
            )
            .all(limit);
    }

    getOverallStats(): any {
        const db = this.getDb();

        const counts = db
            .prepare(
                `
            SELECT 
                COUNT(*) as totalTracks,
                COALESCE(SUM(duration), 0) as totalDuration,
                COALESCE(SUM(file_size), 0) as totalSize,
                (SELECT COUNT(DISTINCT COALESCE(album_artist, artist)) FROM library_files) as uniqueArtists,
                (SELECT COUNT(DISTINCT album) FROM library_files) as totalAlbums
            FROM library_files
        `
            )
            .get() as any;

        return {
            totalTracks: counts.totalTracks || 0,
            totalDuration: counts.totalDuration || 0,
            totalSize: counts.totalSize || 0,
            uniqueArtists: counts.uniqueArtists || 0,
            totalAlbums: counts.totalAlbums || 0
        };
    }

    addLibraryFile(file: {
        file_path: string;
        track_id?: string;
        title?: string;
        artist?: string;
        album_artist?: string;
        album?: string;
        duration?: number;
        quality?: number;
        available_quality?: number;
        file_size?: number;
        format?: string;
        bit_depth?: number;
        sample_rate?: number;
        needs_upgrade?: boolean;
        audio_fingerprint?: string;
        missing_metadata?: boolean;
        missing_tags?: string[];
    }): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT OR REPLACE INTO library_files 
            (file_path, track_id, title, artist, album_artist, album, duration, quality, available_quality, file_size, format, bit_depth, sample_rate, needs_upgrade, scanned_at, audio_fingerprint, missing_metadata, missing_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
            file.file_path,
            file.track_id || null,
            file.title || null,
            file.artist || null,
            file.album_artist || null,
            file.album || null,
            file.duration || 0,
            file.quality || 0,
            file.available_quality || null,
            file.file_size || 0,
            file.format || null,
            file.bit_depth || 0,
            file.sample_rate || 0,
            file.needs_upgrade ? 1 : 0,
            new Date().toISOString(),
            file.audio_fingerprint || null,
            file.missing_metadata ? 1 : 0,
            file.missing_tags ? JSON.stringify(file.missing_tags) : null
        );
    }

    getLibraryFiles(limit = 100, offset = 0): any[] {
        const db = this.getDb();
        return db
            .prepare('SELECT * FROM library_files ORDER BY scanned_at DESC LIMIT ? OFFSET ?')
            .all(limit, offset);
    }

    getUpgradeableFiles(): any[] {
        const db = this.getDb();
        return db
            .prepare(
                `
                SELECT * FROM library_files 
                WHERE needs_upgrade = 1 
                AND track_id IS NOT NULL 
                AND available_quality IS NOT NULL 
                AND available_quality > quality
                ORDER BY artist, album
            `
            )
            .all();
    }

    getMissingMetadataFiles(): any[] {
        const db = this.getDb();
        return db
            .prepare(
                `
                SELECT * FROM library_files 
                WHERE missing_metadata = 1
                ORDER BY file_path ASC
            `
            )
            .all();
    }

    addDuplicate(path1: string, path2: string, matchType: string, confidence: number): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT INTO duplicates (file_path_1, file_path_2, match_type, confidence)
            VALUES (?, ?, ?, ?)
        `
        ).run(path1, path2, matchType, confidence);
    }

    getDuplicates(): any[] {
        const db = this.getDb();
        return db
            .prepare('SELECT * FROM duplicates WHERE resolved = 0 ORDER BY confidence DESC')
            .all();
    }

    resolveDuplicate(id: number): void {
        const db = this.getDb();
        db.prepare('UPDATE duplicates SET resolved = 1 WHERE id = ?').run(id);
    }

    clearLibraryScan(): void {
        const db = this.getDb();
        db.prepare('DELETE FROM library_files').run();
        db.prepare('DELETE FROM duplicates').run();
    }

    resetStatistics(): void {
        const db = this.getDb();
        const tables = [
            'tracks',
            'albums',
            'artists',
            'daily_stats',
            'hourly_stats',
            'genre_stats',
            'quality_stats',
            'library_files',
            'duplicates'
        ];

        const transaction = db.transaction(() => {
            for (const table of tables) {
                db.prepare(`DELETE FROM ${table}`).run();
            }
        });

        transaction();
        logger.info('Database statistics reset', 'DB');
    }

    deleteTrackByPath(filePath: string): void {
        const db = this.getDb();

        let track = db.prepare('SELECT * FROM tracks WHERE file_path = ?').get(filePath) as any;

        if (!track) {
            const filename = path.basename(filePath);
            const parentDir = path.basename(path.dirname(filePath));

            const suffixUnix = `/${parentDir}/${filename}`;
            const suffixWin = `\\${parentDir}\\${filename}`;

            track = db
                .prepare('SELECT * FROM tracks WHERE file_path LIKE ? OR file_path LIKE ?')
                .get(`%${suffixUnix}`, `%${suffixWin}`) as any;
        }

        if (track) {
            const trackPath = track.file_path;

            const transaction = db.transaction(() => {
                db.prepare('DELETE FROM tracks WHERE file_path = ?').run(trackPath);

                const artistName = track.album_artist || track.artist;
                if (artistName) {
                    const artistId = artistName.toLowerCase().replace(/\s+/g, '-');
                    db.prepare(
                        'UPDATE artists SET track_count = MAX(0, track_count - 1) WHERE id = ?'
                    ).run(artistId);
                }

                if (track.quality) {
                    db.prepare(
                        'UPDATE quality_stats SET count = MAX(0, count - 1), total_size = MAX(0, total_size - ?) WHERE quality = ?'
                    ).run(track.file_size || 0, track.quality);
                }

                if (track.genre) {
                    db.prepare(
                        'UPDATE genre_stats SET count = MAX(0, count - 1), total_size = MAX(0, total_size - ?) WHERE genre = ?'
                    ).run(track.file_size || 0, track.genre);
                }
            });

            transaction();
            logger.info(
                `Removed track from database: ${path.basename(filePath)} (matched: ${trackPath})`,
                'DB'
            );
        } else {
            logger.warn(`Could not find track in main DB to delete: ${filePath}`, 'DB');
        }
    }

    async verifyFileIntegrity(filePath: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!fs.existsSync(filePath)) return resolve(false);
            const hash = crypto.createHash('md5');
            const stream = fs.createReadStream(filePath);
            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => {
                const checksum = hash.digest('hex');
                const db = this.getDb();
                const row = db
                    .prepare('SELECT checksum FROM library_files WHERE file_path = ?')
                    .get(filePath) as any;
                resolve(row?.checksum === checksum);
            });
            stream.on('error', () => resolve(false));
        });
    }

    addQueueItem(item: any): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT OR REPLACE INTO queue_items (
                id, type, content_id, quality, status, priority, progress,
                title, artist_data, album_data, error, file_path, added_at,
                started_at, completed_at, retry_count, max_retries, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
            item.id,
            item.type,
            item.contentId,
            item.quality,
            item.status,
            item.priority,
            item.progress,
            item.title,
            item.artist ? JSON.stringify(item.artist) : null,
            item.album ? JSON.stringify(item.album) : null,
            item.error,
            item.filePath,
            item.addedAt?.toISOString(),
            item.startedAt?.toISOString(),
            item.completedAt?.toISOString(),
            item.retryCount,
            item.maxRetries,
            item.metadata ? JSON.stringify(item.metadata) : null
        );
    }

    getQueueItems(): any[] {
        const db = this.getDb();
        const items = db.prepare('SELECT * FROM queue_items ORDER BY added_at ASC').all() as any[];
        return items.map((item) => ({
            ...item,
            artistData: item.artist_data ? JSON.parse(item.artist_data) : null,
            albumData: item.album_data ? JSON.parse(item.album_data) : null,
            metadata: item.metadata ? JSON.parse(item.metadata) : null,
            addedAt: new Date(item.added_at),
            startedAt: item.started_at ? new Date(item.started_at) : null,
            completedAt: item.completed_at ? new Date(item.completed_at) : null
        }));
    }

    updateQueueItemStatus(id: string, status: string, progressOrError?: any): void {
        const db = this.getDb();
        const now = new Date().toISOString();
        if (status === 'downloading' || status === 'pending') {
            const progress = typeof progressOrError === 'number' ? progressOrError : 0;
            db.prepare(
                'UPDATE queue_items SET status = ?, started_at = ?, progress = ? WHERE id = ?'
            ).run(status, now, progress, id);
        } else if (status === 'completed' || status === 'failed') {
            const error = typeof progressOrError === 'string' ? progressOrError : null;
            const progress = status === 'completed' ? 100 : 0;
            db.prepare(
                'UPDATE queue_items SET status = ?, completed_at = ?, error = ?, progress = ? WHERE id = ?'
            ).run(status, now, error, progress, id);
        } else {
            const progress = typeof progressOrError === 'number' ? progressOrError : 0;
            db.prepare('UPDATE queue_items SET status = ?, progress = ? WHERE id = ?').run(
                status,
                progress,
                id
            );
        }
    }

    removeQueueItem(id: string): void {
        const db = this.getDb();
        db.prepare('DELETE FROM queue_items WHERE id = ?').run(id);
    }

    getWatchedPlaylists(): any[] {
        const db = this.getDb();
        return db.prepare('SELECT * FROM watched_playlists ORDER BY created_at DESC').all();
    }

    addWatchedPlaylist(p: {
        id: string;
        playlistId: string;
        title: string;
        quality: number;
        intervalHours: number;
    }): void {
        const db = this.getDb();
        db.prepare(
            `
            INSERT INTO watched_playlists (id, playlist_id, title, quality, interval_hours)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                quality = excluded.quality,
                interval_hours = excluded.interval_hours
        `
        ).run(p.id, p.playlistId, p.title, p.quality, p.intervalHours);
    }

    removeWatchedPlaylist(id: string): void {
        const db = this.getDb();
        db.prepare('DELETE FROM watched_playlists WHERE id = ?').run(id);
    }

    updatePlaylistSyncTime(id: string): void {
        const db = this.getDb();
        db.prepare('UPDATE watched_playlists SET last_synced_at = ? WHERE id = ?').run(
            new Date().toISOString(),
            id
        );
    }
}

export const databaseService = new DatabaseService();
export default databaseService;
