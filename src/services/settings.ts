import { db } from './database.js';
import { logger } from '../utils/logger.js';

interface Settings {
    _help?: string;
    defaultQuality?: string | number;
    embedLyrics?: boolean;
    embedCover?: boolean;
    downloads?: {
        path: string;
        concurrent: number;
        retryAttempts: number;
        retryDelay: number;
        folderTemplate: string;
        fileTemplate: string;
        proxy: string;
    };
    metadata?: {
        saveCoverFile: boolean;
        saveLrcFile: boolean;
        coverSize: string;
        lyricsType: string;
    };
    display?: {
        showProgress: boolean;
        showMetadata: boolean;
        colorScheme: string;
        verbosity: string;
    };
    telegram?: {
        uploadFiles: boolean;
        autoDelete: boolean;
        allowedUsers: string;
    };
    [key: string]: unknown;
}

class SettingsService {
    defaultSettings: Settings;
    settings: Settings;

    constructor() {
        this.defaultSettings = {
            _help: 'Official Documentation: https://github.com/ifauzeee/QBZ-Downloader',
            defaultQuality: 27,
            embedLyrics: true,
            embedCover: true,
            downloads: {
                path: './downloads',
                concurrent: 4,
                retryAttempts: 3,
                retryDelay: 1000,
                folderTemplate: '{artist}/{album}',
                fileTemplate: '{track_number}. {title}',
                proxy: ''
            },
            metadata: {
                saveCoverFile: false,
                saveLrcFile: false,
                coverSize: 'max',
                lyricsType: 'both'
            },
            display: {
                showProgress: true,
                showMetadata: true,
                colorScheme: 'gradient',
                verbosity: 'detailed'
            },
            telegram: {
                uploadFiles: true,
                autoDelete: true,
                allowedUsers: ''
            },
            dashboard: {
                port: 3000,
                password: '',
                autoCleanHours: 24
            }
        };
        this.settings = this.loadSettings();
    }

    loadSettings(): Settings {
        try {
            let dbSettings = db.getAllSettings();

            if (Object.keys(dbSettings).length <= 5) {
                this.migrateFromEnv();
                dbSettings = db.getAllSettings();
            }

            return { ...this.defaultSettings, ...dbSettings };
        } catch (error: unknown) {
            logger.error(`Failed to load settings: ${(error as Error).message}`);
        }
        return { ...this.defaultSettings };
    }

    private migrateFromEnv() {
        const envKeys = [
            'QOBUZ_APP_ID',
            'QOBUZ_APP_SECRET',
            'QOBUZ_USER_AUTH_TOKEN',
            'QOBUZ_TOKEN',
            'QOBUZ_USER_ID',
            'TELEGRAM_BOT_TOKEN',
            'TELEGRAM_CHAT_ID',
            'DASHBOARD_PASSWORD',
            'DASHBOARD_PORT'
        ];

        for (const key of envKeys) {
            const val = process.env[key];
            if (val && db.getSetting(key) === null) {
                db.saveSetting(key, val);
            }
        }
    }

    isConfigured(): boolean {
        const s = this.settings;
        const appId = s.QOBUZ_APP_ID || db.getSetting('QOBUZ_APP_ID');
        const appSecret = s.QOBUZ_APP_SECRET || db.getSetting('QOBUZ_APP_SECRET');
        const token =
            s.QOBUZ_USER_AUTH_TOKEN || s.QOBUZ_TOKEN || db.getSetting('QOBUZ_USER_AUTH_TOKEN');
        const userId = s.QOBUZ_USER_ID || db.getSetting('QOBUZ_USER_ID');

        return !!(appId && appSecret && token && userId);
    }

    saveSettings() {
        try {
            for (const [key, value] of Object.entries(this.settings)) {
                if (key.startsWith('_')) continue;
                db.saveSetting(key, value);
            }
        } catch (error: unknown) {
            logger.error(`Failed to save settings: ${(error as Error).message}`);
        }
    }

    get(key: string) {
        return this.settings[key];
    }

    set(key: string, value: unknown) {
        this.settings[key] = value;
        this.saveSettings();
    }

    reset() {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
    }
}

export const settingsService = new SettingsService();
