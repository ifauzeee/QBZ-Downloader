import { databaseService } from './database/index.js';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const SENSITIVE_KEYS = [
    'QOBUZ_APP_ID',
    'QOBUZ_APP_SECRET',
    'QOBUZ_USER_AUTH_TOKEN',
    'DASHBOARD_PASSWORD',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'MEDIA_SERVER_TOKEN',
    'AI_API_KEY'
];

const KNOWN_SETTING_KEYS = [
    'QOBUZ_APP_ID',
    'QOBUZ_APP_SECRET',
    'QOBUZ_USER_AUTH_TOKEN',
    'QOBUZ_USER_ID',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'DOWNLOADS_PATH',
    'DEFAULT_QUALITY',
    'MAX_CONCURRENCY',
    'RETRY_ATTEMPTS',
    'RETRY_DELAY',
    'FOLDER_TEMPLATE',
    'FILE_TEMPLATE',
    'EMBED_COVER_ART',
    'SAVE_COVER_FILE',
    'COVER_SIZE',
    'DOWNLOAD_LYRICS',
    'EMBED_LYRICS',
    'SAVE_LRC_FILE',
    'LYRICS_TYPE',
    'DASHBOARD_PORT',
    'DASHBOARD_PASSWORD',
    'DASHBOARD_HOST',
    'STREAMING_QUALITY',
    'MEDIA_SERVER_ENABLED',
    'MEDIA_SERVER_TYPE',
    'MEDIA_SERVER_URL',
    'MEDIA_SERVER_TOKEN',
    'MEDIA_SERVER_LIBRARY_ID',
    'EXPORT_ENABLED',
    'EXPORT_FORMAT',
    'EXPORT_BITRATE',
    'EXPORT_KEEP_ORIGINAL',
    'EXPORT_PATH',
    'AI_REPAIR_ENABLED',
    'AI_PROVIDER',
    'AI_API_KEY',
    'AI_MODEL',
    'BANDWIDTH_LIMIT',
    'UI_BATCH_STAGING_URLS',
    'UI_LAST_TAB',
    'UI_ACTIVE_THEME_ID',
    'UI_LANGUAGE',
    'UI_THEME',
    'UI_ACCENT'
] as const;

export type KnownSettingKey = (typeof KNOWN_SETTING_KEYS)[number];

export class SettingsService {

    private initialized = false;
    private cache = new Map<string, { value: string; timestamp: number }>();
    private readonly CACHE_TTL = 5000; // 5 seconds

    private ensureInitialized() {
        if (this.initialized) return;

        try {
            const db = databaseService.getDb();
            db.exec(`
                CREATE TABLE IF NOT EXISTS app_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const rows = db.prepare('SELECT key, value FROM app_settings').all() as Array<{
                key: string;
                value: string;
            }>;

            this.cache.clear();
            const now = Date.now();
            for (const row of rows) {
                const value = SENSITIVE_KEYS.includes(row.key) ? decrypt(row.value) : row.value;
                this.cache.set(row.key, { value, timestamp: now });
            }

            if (this.cache.size > 0) {
                logger.success(`Loaded ${this.cache.size} setting(s) from database`, 'SETTINGS');
            }

            if (this.cache.size === 0) {
                let seeded = 0;
                const upsert = db.prepare(
                    `INSERT INTO app_settings (key, value, updated_at)
                     VALUES (?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = CURRENT_TIMESTAMP`
                );

                for (const key of KNOWN_SETTING_KEYS) {
                    const value = process.env[key];
                    if (value !== undefined && value !== '') {
                        upsert.run(key, value);
                        this.cache.set(key, { value, timestamp: Date.now() });
                        seeded++;
                    }
                }

                if (seeded > 0) {
                    logger.info(`Migrated ${seeded} setting(s) from environment to local database`, 'SETTINGS');
                }
            }

            this.initialized = true;
        } catch (error: unknown) {
            logger.warn(`Settings service init failed: ${(error as Error).message}`, 'SETTINGS');
        }
    }

    get(key: string): string | undefined {
        this.ensureInitialized();
        const cached = this.cache.get(key);
        const now = Date.now();

        if (cached && now - cached.timestamp < this.CACHE_TTL) {
            return cached.value;
        }

        try {
            const db = databaseService.getDb();
            const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined;
            
            if (row) {
                const value = SENSITIVE_KEYS.includes(key) ? decrypt(row.value) : row.value;
                this.cache.set(key, { value, timestamp: now });
                return value;
            }
        } catch {
            // Fallback to cache even if expired if DB fails
            if (cached) return cached.value;
        }

        return undefined;
    }

    getMany(keys: string[]): Record<string, string | undefined> {
        this.ensureInitialized();
        const result: Record<string, string | undefined> = {};
        for (const key of keys) {
            result[key] = this.get(key);
        }
        return result;
    }

    set(key: string, value: string): void {
        this.ensureInitialized();

        try {
            const db = databaseService.getDb();
            const valueToStore = SENSITIVE_KEYS.includes(key) ? encrypt(value) : value;

            db.prepare(
                `INSERT INTO app_settings (key, value, updated_at)
                 VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET
                    value = excluded.value,
                    updated_at = CURRENT_TIMESTAMP`
            ).run(key, valueToStore);

            this.cache.set(key, { value, timestamp: Date.now() });
            process.env[key] = value;
        } catch (error: unknown) {
            logger.error(`Failed to save setting ${key}: ${(error as Error).message}`, 'SETTINGS');
            throw error;
        }
    }

    setMany(values: Record<string, string>): void {
        this.ensureInitialized();

        try {
            const db = databaseService.getDb();
            const tx = db.transaction((entries: Array<[string, string]>) => {
                const stmt = db.prepare(
                    `INSERT INTO app_settings (key, value, updated_at)
                     VALUES (?, ?, CURRENT_TIMESTAMP)
                     ON CONFLICT(key) DO UPDATE SET
                        value = excluded.value,
                        updated_at = CURRENT_TIMESTAMP`
                );

                for (const [key, value] of entries) {
                    const valueToStore = SENSITIVE_KEYS.includes(key) ? encrypt(value) : value;
                    stmt.run(key, valueToStore);
                    this.cache.set(key, { value, timestamp: Date.now() });
                    process.env[key] = value;
                }
            });

            tx(Object.entries(values));
        } catch (error: unknown) {
            logger.error(`Failed to save settings batch: ${(error as Error).message}`, 'SETTINGS');
            throw error;
        }
    }
}

export const settingsService = new SettingsService();

