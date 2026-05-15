import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeService } from './ThemeService.js';
import { databaseService } from './database/index.js';

// Mock dependencies
vi.mock('./database/index.js', () => ({
    databaseService: {
        getDb: vi.fn().mockReturnValue({
            prepare: vi.fn().mockReturnValue({
                run: vi.fn().mockReturnValue({ changes: 1, lastInsertRowid: 1 }),
                all: vi.fn().mockReturnValue([]),
                get: vi.fn().mockReturnValue(null)
            })
        })
    }
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

describe('ThemeService', () => {
    let service: ThemeService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new ThemeService();
    });

    it('should get all themes with correctly mapped values', async () => {
        const mockThemes = [
            { id: '1', name: 'Dark', is_dark: 1, colors: '{"primary":"#000"}' },
            { id: '2', name: 'Light', is_dark: 0, colors: '{"primary":"#fff"}' }
        ];
        vi.mocked(databaseService.getDb().prepare('').all).mockReturnValue(mockThemes);

        const themes = await service.getAll();
        expect(themes).toHaveLength(2);
        expect(themes[0].is_dark).toBe(true);
        expect(themes[1].is_dark).toBe(false);
        expect(themes[0].colors.primary).toBe('#000');
    });

    it('should create a new theme', async () => {
        const theme = await service.create('Custom', true, { primary: '#f00' });
        expect(theme.name).toBe('Custom');
        expect(theme.id).toBeDefined();
        expect(databaseService.getDb().prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO themes'));
    });

    it('should update an existing theme', async () => {
        const theme = await service.update('1', 'Updated', false, { primary: '#ccc' });
        expect(theme?.name).toBe('Updated');
        expect(databaseService.getDb().prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE themes'));
    });

    it('should delete a theme', async () => {
        const success = await service.delete('1');
        expect(success).toBe(true);
        expect(databaseService.getDb().prepare).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM themes'));
    });

    it('should return null if update fails (no changes)', async () => {
        vi.mocked(databaseService.getDb().prepare('').run).mockReturnValueOnce({ changes: 0, lastInsertRowid: 0 });
        const result = await service.update('999', 'Fail', true, {});
        expect(result).toBeNull();
    });
});
