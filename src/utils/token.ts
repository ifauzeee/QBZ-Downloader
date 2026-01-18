import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { CONFIG } from '../config.js';
import { logger } from './logger.js';

class TokenManager extends EventEmitter {
    private token: string;
    private lastValidated: number = 0;
    private isValid: boolean | null = null;
    private refreshInProgress: boolean = false;

    constructor() {
        super();
        this.token = CONFIG.credentials.token || '';
    }

    getToken(): string {
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

        if (key === 'QOBUZ_APP_ID') process.env.QOBUZ_APP_ID = val;
        if (key === 'QOBUZ_APP_SECRET') process.env.QOBUZ_APP_SECRET = val;
        if (key === 'QOBUZ_USER_AUTH_TOKEN') process.env.QOBUZ_USER_AUTH_TOKEN = val;
        if (key === 'QOBUZ_USER_ID') process.env.QOBUZ_USER_ID = val;

        try {
            await this.persistToEnv(key, val);
            if (key === 'QOBUZ_USER_AUTH_TOKEN') {
                this.isValid = null;
                logger.success('Token updated successfully');
            } else {
                logger.success(`Config ${key} updated`);
            }
            return true;
        } catch (error: any) {
            logger.error(`Failed to persist ${key}: ${error.message}`);
            return false;
        }
    }

    private async persistToEnv(key: string, value: string): Promise<void> {
        const envPath = path.resolve(process.cwd(), '.env');

        if (!fs.existsSync(envPath)) {
            fs.writeFileSync(envPath, `${key}=${value}\n`, 'utf8');
            return;
        }

        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');

        let found = false;
        const newLines = lines.map((line) => {
            if (line.startsWith(`${key}=`)) {
                found = true;
                return `${key}=${value}`;
            }
            return line;
        });

        if (!found) {
            newLines.push(`${key}=${value}`);
        }

        fs.writeFileSync(envPath, newLines.join('\n'), 'utf8');
    }

    markInvalid(): void {
        this.isValid = false;
        this.emit('token:invalid');
        logger.warn('Token marked as invalid');
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
        logger.warn('No token configured. Please set QOBUZ_USER_AUTH_TOKEN in .env');
        return null;
    }

    logger.warn('Token expired or invalid. Please update via Dashboard Settings.');
    tokenManager.markInvalid();

    return null;
}
