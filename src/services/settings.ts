import fs from 'fs';
import path from 'path';

const SETTINGS_FILE = 'settings.json';

interface Settings {
    defaultQuality?: string | number;
    embedLyrics?: boolean;
    embedCover?: boolean;
    [key: string]: any;
}

class SettingsService {
    settingsPath: string;
    defaultSettings: Settings;
    settings: Settings;

    constructor() {
        this.settingsPath = path.resolve(process.cwd(), SETTINGS_FILE);
        this.defaultSettings = {
            defaultQuality: 'ask',
            embedLyrics: true,
            embedCover: true
        };
        this.settings = this.loadSettings();
    }

    loadSettings(): Settings {
        try {
            if (fs.existsSync(this.settingsPath)) {
                const data = fs.readFileSync(this.settingsPath, 'utf8');
                return { ...this.defaultSettings, ...JSON.parse(data) };
            }
        } catch (error: any) {
            console.error('Failed to load settings:', error.message);
        }
        return { ...this.defaultSettings };
    }

    saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch (error: any) {
            console.error('Failed to save settings:', error.message);
        }
    }

    get(key: string) {
        return this.settings[key];
    }

    set(key: string, value: any) {
        this.settings[key] = value;
        this.saveSettings();
    }
}

export const settingsService = new SettingsService();
