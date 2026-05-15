import { EventEmitter } from 'events';
import { CONFIG } from '../config.js';
import { logger } from './logger.js';
import { settingsService } from '../services/settings.js';

class TokenManager extends EventEmitter {
    private token: string;
    private lastValidated: number = 0;
    private isValid: boolean | null = null;
    private refreshInProgress: boolean = false;

    constructor() {
        super();
        this.token = CONFIG.credentials.token || '';
    }

    private syncTokenFromConfig(): void {
        this.token = CONFIG.credentials.token || '';
    }

    getToken(): string {
        this.syncTokenFromConfig();
        return this.token;
    }

    async updateToken(newToken: string): Promise<boolean> {
        return this.updateConfig('QOBUZ_USER_AUTH_TOKEN', newToken);
    }

    async updateConfig(key: string, value: string): Promise<boolean> {
        if (!value || value.trim() === '') return false;

        const validKeys = [
            'QOBUZ_APP_ID',
            'QOBUZ_APP_SECRET',
            'QOBUZ_USER_AUTH_TOKEN',
            'QOBUZ_USER_ID'
        ];
        if (!validKeys.includes(key)) return false;

        const val = value.trim();
        if (key === 'QOBUZ_USER_AUTH_TOKEN') {
            const oldToken = this.token;
            this.token = val;
            this.emit('token:updated', { oldToken: oldToken.slice(-4), newToken: val.slice(-4) });
        }

        try {
            settingsService.set(key, val);
            if (key === 'QOBUZ_USER_AUTH_TOKEN') {
                this.isValid = null;
                logger.success('Token updated successfully');
            } else {
                logger.success(`Config ${key} updated`);
            }
            return true;
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to persist ${key}: ${message}`);
            return false;
        }
    }

    markInvalid(): void {
        if (!this.token) return; 
        const previouslyValid = this.isValid !== false;
        this.isValid = false;
        if (previouslyValid) {
            this.emit('token:invalid');
            logger.warn('Token marked as invalid');
        }
    }

    markValid(): void {
        this.isValid = true;
        this.lastValidated = Date.now();
        this.emit('token:valid');
    }

    needsRefresh(): boolean {
        return this.isValid === false;
    }

    getStatus(): { configured: boolean; valid: boolean | null; lastValidated: number | null } {
        this.syncTokenFromConfig();
        return {
            configured: !!this.token,
            valid: this.isValid,
            lastValidated: this.lastValidated || null
        };
    }
}

export const tokenManager = new TokenManager();

export async function refreshUserToken(): Promise<string | null> {
    const status = tokenManager.getStatus();

    if (!status.configured) {
        logger.warn('No token configured. Please set QOBUZ_USER_AUTH_TOKEN in Settings.');
        return null;
    }

    // Only mark invalid and notify if we haven't already marked it as invalid
    if (status.valid !== false) {
        logger.warn('Token expired or invalid. Please update via Dashboard Settings.');
        tokenManager.markInvalid();
    }

    return null;
}
