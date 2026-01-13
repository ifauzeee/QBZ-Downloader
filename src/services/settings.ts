import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = 'settings.json';

interface Settings {
    _help?: string;
    defaultQuality?: string | number;
    embedLyrics?: boolean;
    embedCover?: boolean;
    [key: string]: unknown;
}

class SettingsService {
    settingsPath: string;
    defaultSettings: Settings;
    settings: Settings;

    constructor() {
        this.settingsPath = path.resolve(process.cwd(), SETTINGS_FILE);
        this.defaultSettings = {
            _help: 'Official Documentation: https://github.com/ifauzeee/QBZ-Downloader',
            defaultQuality: 'ask',
            embedLyrics: true,
            embedCover: true,
            downloads: {
                _description: 'Download engine and folder structure settings',
                path: './downloads',
                concurrent: 4,
                retryAttempts: 3,
                retryDelay: 1000,
                folderTemplate: '{artist}/{album}',
                fileTemplate: '{track_number} {title}'
            },
            quality: {
                _description: 'Audio quality settings. 27=Hi-Res, 7=CD, 6=MP3 320',
                default: 27,
                formats: {
                    '5': {
                        name: 'MP3 320',
                        bitDepth: null,
                        sampleRate: null,
                        extension: 'mp3'
                    },
                    '6': {
                        name: 'FLAC 16-bit/44.1kHz (CD Quality)',
                        bitDepth: 16,
                        sampleRate: 44100,
                        extension: 'flac'
                    },
                    '7': {
                        name: 'FLAC 24-bit/96kHz (Hi-Res)',
                        bitDepth: 24,
                        sampleRate: 96000,
                        extension: 'flac'
                    },
                    '27': {
                        name: 'FLAC 24-bit/192kHz (Hi-Res Max)',
                        bitDepth: 24,
                        sampleRate: 192000,
                        extension: 'flac'
                    }
                }
            },
            metadata: {
                _description: 'Tagging and artwork embedding options',
                embedCover: true,
                saveCoverFile: false,
                saveLrcFile: false,
                coverSize: 'max',
                embedLyrics: true,
                lyricsType: 'both'
            },
            display: {
                _description: 'CLI UI and Terminal appearance',
                showProgress: true,
                showMetadata: true,
                colorScheme: 'gradient',
                verbosity: 'detailed'
            },
            telegram: {
                _description: 'Telegram Bot notification and auto-upload settings',
                uploadFiles: true,
                autoDelete: true
            }
        };
        this.settings = this.loadSettings();
    }

    loadSettings(): Settings {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8');
                return { ...this.defaultSettings, ...JSON.parse(data) };
            }
        } catch (error: unknown) {
            console.error('Failed to load settings:', (error as Error).message);
        }
        return { ...this.defaultSettings };
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (error: unknown) {
            console.error('Failed to save settings:', (error as Error).message);
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
