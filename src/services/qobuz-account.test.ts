import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QobuzAccountService } from './QobuzAccountService.js';
import { settingsService } from './settings.js';
import { tokenManager } from '../utils/token.js';

const store = vi.hoisted(() => new Map<string, string>());

vi.mock('./settings.js', () => ({
    settingsService: {
        get: vi.fn((key: string) => store.get(key)),
        set: vi.fn((key: string, value: string) => {
            store.set(key, value);
        }),
        setMany: vi.fn((values: Record<string, string>) => {
            for (const [key, value] of Object.entries(values)) {
                store.set(key, value);
            }
        })
    }
}));

vi.mock('../utils/token.js', () => ({
    tokenManager: {
        clearValidation: vi.fn()
    }
}));

describe('QobuzAccountService', () => {
    let service: QobuzAccountService;

    beforeEach(() => {
        store.clear();
        vi.clearAllMocks();
        service = new QobuzAccountService();
    });

    it('should create a redacted account and activate the first account', () => {
        const account = service.create({
            name: 'Personal',
            appId: 'app-id',
            appSecret: 'secret',
            token: 'token',
            userId: 'user-id'
        });

        expect(account.name).toBe('Personal');
        expect(account.active).toBe(true);
        expect(account.tokenConfigured).toBe(true);
        expect('token' in account).toBe(false);
        expect(settingsService.set).toHaveBeenCalledWith(
            'QOBUZ_ACCOUNTS',
            expect.stringContaining('Personal')
        );
        expect(settingsService.setMany).toHaveBeenCalledWith(
            expect.objectContaining({
                QOBUZ_ACTIVE_ACCOUNT_ID: account.id,
                QOBUZ_APP_ID: 'app-id',
                QOBUZ_APP_SECRET: 'secret',
                QOBUZ_USER_AUTH_TOKEN: 'token',
                QOBUZ_USER_ID: 'user-id'
            })
        );
    });

    it('should switch active credentials between accounts', () => {
        const first = service.create({
            name: 'Personal',
            appId: 'app-1',
            appSecret: 'secret-1',
            token: 'token-1',
            userId: 'user-1'
        });
        const second = service.create({
            name: 'Family',
            appId: 'app-2',
            appSecret: 'secret-2',
            token: 'token-2',
            userId: 'user-2'
        });

        expect(service.getActiveAccountId()).toBe(first.id);

        const switched = service.switchTo(second.id);

        expect(switched.active).toBe(true);
        expect(store.get('QOBUZ_ACTIVE_ACCOUNT_ID')).toBe(second.id);
        expect(store.get('QOBUZ_APP_ID')).toBe('app-2');
        expect(store.get('QOBUZ_USER_AUTH_TOKEN')).toBe('token-2');
        expect(tokenManager.clearValidation).toHaveBeenCalled();
    });

    it('should update the active credentials when the active account changes', () => {
        const account = service.create({
            name: 'Personal',
            appId: 'app-id',
            appSecret: 'secret',
            token: 'token',
            userId: 'user-id'
        });

        service.update(account.id, { token: 'new-token' });

        expect(store.get('QOBUZ_USER_AUTH_TOKEN')).toBe('new-token');
    });
});
