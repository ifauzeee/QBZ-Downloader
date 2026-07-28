import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SettingsService } from './settings.js';
import { databaseService } from './database/index.js';

import { encryptionService } from '../utils/encryption.js';
import { eventBus, EVENTS } from '../utils/events.js';

// Mock dependencies
vi.mock('./database/index.js', () => ({
    databaseService: {
        getDb: vi.fn().mockReturnValue({
            exec: vi.fn(),
            prepare: vi.fn().mockReturnValue({
                all: vi.fn().mockReturnValue([]),
                run: vi.fn()
            }),
            transaction: vi.fn().mockImplementation((fn) => fn)
        })
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

vi.mock('../utils/encryption.js', () => ({
    encryptionService: {
        encryptSync: vi.fn((v) => `enc_${v}`),
        decryptSync: vi.fn((v) => v.replace('enc_', '')),
        isEncryptedSync: vi.fn(() => true),
    }
}));

describe('SettingsService', () => {
    let settings: SettingsService;

    beforeEach(() => {
        vi.clearAllMocks();
        settings = new SettingsService();
    });

    it('should set and get a normal setting', () => {
        const emitSpy = vi.spyOn(eventBus, 'emit');
        settings.set('THEME', 'dark');
        expect(settings.get('THEME')).toBe('dark');
        expect(databaseService.getDb().prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app_settings'));
        expect(emitSpy).toHaveBeenCalledWith(EVENTS.SETTINGS.UPDATED, { keys: ['THEME'] });
    });

    it('should encrypt sensitive keys', () => {
        settings.set('AI_API_KEY', 'secret-key');
        expect(encryptionService.encryptSync).toHaveBeenCalledWith('secret-key');
        expect(settings.get('AI_API_KEY')).toBe('secret-key');
    });

    it('should encrypt stored Qobuz account bundles', () => {
        settings.set('QOBUZ_ACCOUNTS', '[{"name":"Personal","token":"secret"}]');
        expect(encryptionService.encryptSync).toHaveBeenCalledWith('[{"name":"Personal","token":"secret"}]');
    });

    it('should handle setMany correctly', () => {
        const emitSpy = vi.spyOn(eventBus, 'emit');
        settings.setMany({
            'KEY1': 'VAL1',
            'KEY2': 'VAL2'
        });
        expect(settings.get('KEY1')).toBe('VAL1');
        expect(settings.get('KEY2')).toBe('VAL2');
        expect(emitSpy).toHaveBeenCalledWith(EVENTS.SETTINGS.UPDATED, { keys: ['KEY1', 'KEY2'] });
    });

    it('should return many settings at once', () => {
        settings.set('A', '1');
        settings.set('B', '2');
        const many = settings.getMany(['A', 'B', 'C']);
        expect(many).toEqual({
            'A': '1',
            'B': '2',
            'C': undefined
        });
    });

    it('should initialize and load from database', () => {
        vi.mocked(databaseService.getDb().prepare('').all).mockReturnValueOnce([
            { key: 'LOADED', value: 'yes' }
        ]);

        expect(settings.get('LOADED')).toBe('yes');
    });

    describe('environment overrides', () => {
        afterEach(() => {
            delete process.env.DASHBOARD_PASSWORD;
        });

        it('should let an env var override a value already stored in the database', () => {
            process.env.DASHBOARD_PASSWORD = 'from-env';
            vi.mocked(databaseService.getDb().prepare('').all).mockReturnValueOnce([
                { key: 'DASHBOARD_PASSWORD', value: 'enc_from-database' }
            ]);

            expect(settings.get('DASHBOARD_PASSWORD')).toBe('from-env');
            expect(encryptionService.encryptSync).toHaveBeenCalledWith('from-env');
        });

        it('should keep the stored value when the env var is not set', () => {
            vi.mocked(databaseService.getDb().prepare('').all).mockReturnValueOnce([
                { key: 'DASHBOARD_PASSWORD', value: 'enc_from-database' }
            ]);

            expect(settings.get('DASHBOARD_PASSWORD')).toBe('from-database');
            expect(encryptionService.encryptSync).not.toHaveBeenCalledWith('from-database');
        });

        it('should not rewrite the database when env matches the stored value', () => {
            process.env.DASHBOARD_PASSWORD = 'same-value';
            vi.mocked(databaseService.getDb().prepare('').all).mockReturnValueOnce([
                { key: 'DASHBOARD_PASSWORD', value: 'enc_same-value' }
            ]);

            expect(settings.get('DASHBOARD_PASSWORD')).toBe('same-value');
            expect(encryptionService.encryptSync).not.toHaveBeenCalledWith('same-value');
        });
    });
});
