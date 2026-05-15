import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsService } from './settings.js';
import { databaseService } from './database/index.js';
import { encrypt } from '../utils/crypto.js';

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

vi.mock('../utils/crypto.js', () => ({
    encrypt: vi.fn((v) => `enc_${v}`),
    decrypt: vi.fn((v) => v.replace('enc_', ''))
}));

describe('SettingsService', () => {
    let settings: SettingsService;

    beforeEach(() => {
        vi.clearAllMocks();
        settings = new SettingsService();
    });

    it('should set and get a normal setting', () => {
        settings.set('THEME', 'dark');
        expect(settings.get('THEME')).toBe('dark');
        expect(databaseService.getDb().prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO app_settings'));
    });

    it('should encrypt sensitive keys', () => {
        settings.set('AI_API_KEY', 'secret-key');
        expect(encrypt).toHaveBeenCalledWith('secret-key');
        expect(settings.get('AI_API_KEY')).toBe('secret-key'); // Cache should have decrypted value
    });

    it('should handle setMany correctly', () => {
        settings.setMany({
            'KEY1': 'VAL1',
            'KEY2': 'VAL2'
        });
        expect(settings.get('KEY1')).toBe('VAL1');
        expect(settings.get('KEY2')).toBe('VAL2');
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
});
