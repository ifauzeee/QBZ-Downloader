import fs from 'fs';
import path from 'path';

const BOT_SETTINGS_FILE = 'bot-settings.json';

export interface BotSettings {
    defaultQuality: number | 'ask';
}

class BotSettingsService {
    private settingsPath: string;
    private settings: BotSettings;

    constructor() {
        this.settingsPath = path.resolve(process.cwd(), BOT_SETTINGS_FILE);
        this.settings = this.loadSettings();
    }

    private loadSettings(): BotSettings {
        try {
            if (fs.existsSync(this.settingsPath)) {
                return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
            }
        } catch {}
        return { defaultQuality: 'ask' };
    }

    private saveSettings() {
        try {
            fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
        } catch {}
    }

    get quality(): number | 'ask' {
        return this.settings.defaultQuality;
    }

    set quality(val: number | 'ask') {
        this.settings.defaultQuality = val;
        this.saveSettings();
    }
}

export const botSettingsService = new BotSettingsService();
