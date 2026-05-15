import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeService } from './ThemeService.js';
import { databaseService } from './database/index.js';
import crypto from 'crypto';

// Mock dependencies
vi.mock('./database/index.js', () => ({
    databaseService: {
        getDb: vi.fn().mockReturnValue({
            prepare: vi.fn().mockReturnValue({
                run: vi.fn().mockReturnValue({ changes: 1 }),
                all: vi.fn().mockReturnValue([]),
                get: vi.fn().mockReturnValue(null)
            })
        })
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn()
    }
}));

vi.mock('crypto', () => ({
    default: {
        randomUUID: vi.fn().mockReturnValue('uuid-123')
    }
}));

describe('ThemeService', () => {
    let service: ThemeService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ThemeService();
    });

    it('should create a new theme', async () => {
        const colors = { primary: '#ff0000' };
        const theme = await service.create('Red Theme', true, colors);

        expect(theme.id).toBe('uuid-123');
        expect(theme.name).toBe('Red Theme');
        expect(theme.colors).toEqual(colors);
        expect(databaseService.getDb().prepare).toHaveBeenCalled();
    });

    it('should update an existing theme', async () => {
        const colors = { primary: '#00ff00' };
        const theme = await service.update('uuid-123', 'Green Theme', false, colors);

        expect(theme?.name).toBe('Green Theme');
        expect(theme?.is_dark).toBe(false);
    });

    it('should return null if update fails', async () => {
        vi.mocked(databaseService.getDb().prepare('').run).mockReturnValueOnce({ changes: 0 });
        const theme = await service.update('unknown', 'Name', true, {});
        expect(theme).toBeNull();
    });

    it('should delete a theme', async () => {
        const deleted = await service.delete('uuid-123');
        expect(deleted).toBe(true);
    });

    it('should get all themes and parse colors', async () => {
        const mockRow = {
            id: '1',
            name: 'T1',
            is_dark: 1,
            colors: '{"c": "v"}',
            created_at: '2023',
            updated_at: '2023'
        };
        vi.mocked(databaseService.getDb().prepare('').all).mockReturnValueOnce([mockRow]);

        const themes = await service.getAll();
        expect(themes.length).toBe(1);
        expect(themes[0].colors).toEqual({ c: 'v' });
        expect(themes[0].is_dark).toBe(true);
    });
});
