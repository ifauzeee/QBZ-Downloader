import crypto from 'crypto';
import { settingsService } from './settings.js';
import { tokenManager } from '../utils/token.js';

export interface QobuzAccount {
    id: string;
    name: string;
    appId: string;
    appSecret: string;
    token: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
}

export interface PublicQobuzAccount {
    id: string;
    name: string;
    userIdConfigured: boolean;
    appIdConfigured: boolean;
    appSecretConfigured: boolean;
    tokenConfigured: boolean;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

export type QobuzAccountInput = {
    name: string;
    appId: string;
    appSecret: string;
    token: string;
    userId: string;
};

const ACCOUNTS_KEY = 'QOBUZ_ACCOUNTS';
const ACTIVE_ACCOUNT_KEY = 'QOBUZ_ACTIVE_ACCOUNT_ID';

export class QobuzAccountService {
    private readAccounts(): QobuzAccount[] {
        const raw = settingsService.get(ACCOUNTS_KEY);
        if (!raw) return [];

        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter((account): account is QobuzAccount => {
                return (
                    account &&
                    typeof account.id === 'string' &&
                    typeof account.name === 'string' &&
                    typeof account.appId === 'string' &&
                    typeof account.appSecret === 'string' &&
                    typeof account.token === 'string' &&
                    typeof account.userId === 'string'
                );
            });
        } catch {
            return [];
        }
    }

    private saveAccounts(accounts: QobuzAccount[]): void {
        settingsService.set(ACCOUNTS_KEY, JSON.stringify(accounts));
    }

    private toPublic(account: QobuzAccount): PublicQobuzAccount {
        const activeId = this.getActiveAccountId();
        return {
            id: account.id,
            name: account.name,
            userIdConfigured: !!account.userId,
            appIdConfigured: !!account.appId,
            appSecretConfigured: !!account.appSecret,
            tokenConfigured: !!account.token,
            active: account.id === activeId,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt
        };
    }

    private normalizeInput(input: Partial<QobuzAccountInput>): QobuzAccountInput {
        const normalized = {
            name: String(input.name || '').trim(),
            appId: String(input.appId || '').trim(),
            appSecret: String(input.appSecret || '').trim(),
            token: String(input.token || '').trim(),
            userId: String(input.userId || '').trim()
        };

        const missing = Object.entries(normalized)
            .filter(([, value]) => !value)
            .map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`Missing Qobuz account field(s): ${missing.join(', ')}`);
        }

        return normalized;
    }

    list(): PublicQobuzAccount[] {
        return this.readAccounts().map((account) => this.toPublic(account));
    }

    getActiveAccountId(): string {
        return settingsService.get(ACTIVE_ACCOUNT_KEY) || '';
    }

    create(input: Partial<QobuzAccountInput>, activate = false): PublicQobuzAccount {
        const normalized = this.normalizeInput(input);
        const now = new Date().toISOString();
        const account: QobuzAccount = {
            id: crypto.randomUUID(),
            ...normalized,
            createdAt: now,
            updatedAt: now
        };

        const accounts = [...this.readAccounts(), account];
        this.saveAccounts(accounts);

        if (activate || accounts.length === 1) {
            this.switchTo(account.id);
        }

        return this.toPublic(account);
    }

    update(id: string, input: Partial<QobuzAccountInput>): PublicQobuzAccount {
        const accounts = this.readAccounts();
        const index = accounts.findIndex((account) => account.id === id);
        if (index === -1) throw new Error('Qobuz account not found');

        const existing = accounts[index];
        const updated: QobuzAccount = {
            ...existing,
            name: input.name !== undefined ? String(input.name).trim() : existing.name,
            appId: input.appId !== undefined ? String(input.appId).trim() : existing.appId,
            appSecret:
                input.appSecret !== undefined ? String(input.appSecret).trim() : existing.appSecret,
            token: input.token !== undefined ? String(input.token).trim() : existing.token,
            userId: input.userId !== undefined ? String(input.userId).trim() : existing.userId,
            updatedAt: new Date().toISOString()
        };

        this.normalizeInput(updated);
        accounts[index] = updated;
        this.saveAccounts(accounts);

        if (this.getActiveAccountId() === id) {
            this.activateCredentials(updated);
        }

        return this.toPublic(updated);
    }

    remove(id: string): boolean {
        const accounts = this.readAccounts();
        const remaining = accounts.filter((account) => account.id !== id);
        if (remaining.length === accounts.length) return false;

        this.saveAccounts(remaining);
        if (this.getActiveAccountId() === id) {
            settingsService.setMany({
                [ACTIVE_ACCOUNT_KEY]: '',
                QOBUZ_APP_ID: '',
                QOBUZ_APP_SECRET: '',
                QOBUZ_USER_AUTH_TOKEN: '',
                QOBUZ_USER_ID: ''
            });
            tokenManager.clearValidation();
        }

        return true;
    }

    switchTo(id: string): PublicQobuzAccount {
        const account = this.readAccounts().find((item) => item.id === id);
        if (!account) throw new Error('Qobuz account not found');

        this.activateCredentials(account);
        return this.toPublic(account);
    }

    private activateCredentials(account: QobuzAccount): void {
        settingsService.setMany({
            [ACTIVE_ACCOUNT_KEY]: account.id,
            QOBUZ_APP_ID: account.appId,
            QOBUZ_APP_SECRET: account.appSecret,
            QOBUZ_USER_AUTH_TOKEN: account.token,
            QOBUZ_USER_ID: account.userId
        });
        tokenManager.clearValidation();
    }
}

export const qobuzAccountService = new QobuzAccountService();
