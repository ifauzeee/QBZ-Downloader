import { databaseService } from './database/index.js';
import { logger } from '../utils/logger.js';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto.js';

const SENSITIVE_KEYS = [
    'QOBUZ_APP_ID',
    'QOBUZ_APP_SECRET',
    'QOBUZ_USER_AUTH_TOKEN',
    'DASHBOARD_PASSWORD'
];

const KNOWN_SETTING_KEYS = [
    'QOBUZ_APP_ID',
    'QOBUZ_APP_SECRET',
    'QOBUZ_USER_AUTH_TOKEN',
    'QOBUZ_USER_ID',
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
    'STREAMING_QUALITY'
] as const;

export type KnownSettingKey = (typeof KNOWN_SETTING_KEYS)[number];

class SettingsService {
    private initialized = false;
    private cache = new Map<string, string>();

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
            for (const row of rows) {
                const value = SENSITIVE_KEYS.includes(row.key) ? decrypt(row.value) : row.value;
                this.cache.set(row.key, value);
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
                        this.cache.set(key, value);
                        seeded++;
                    }
                }

                if (seeded > 0) {
                    logger.info(`Migrated ${seeded} setting(s) from environment to local database`, 'SETTINGS');
                }
            }

            this.initialized = true;
        } catch (error: any) {
            logger.warn(`Settings service init failed: ${error.message}`, 'SETTINGS');
        }
    }

    get(key: string): string | undefined {
        this.ensureInitialized();
        return this.cache.get(key);
    }

    getMany(keys: string[]): Record<string, string | undefined> {
        this.ensureInitialized();
        const result: Record<string, string | undefined> = {};
        for (const key of keys) {
            result[key] = this.cache.get(key);
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

            this.cache.set(key, value);
            process.env[key] = value;
        } catch (error: any) {
            logger.error(`Failed to save setting ${key}: ${error.message}`, 'SETTINGS');
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
                    this.cache.set(key, value);
                    process.env[key] = value;
                }
            });

            tx(Object.entries(values));
        } catch (error: any) {
            logger.error(`Failed to save settings batch: ${error.message}`, 'SETTINGS');
            throw error;
        }
    }
}

export const settingsService = new SettingsService();

