import { describe, expect, it } from 'vitest';
import {
    buildTrackFilterSql,
    sanitizeSmartPlaylistFilter
} from './smart-playlists.js';

describe('sanitizeSmartPlaylistFilter', () => {
    it('keeps only whitelisted, non-empty fields', () => {
        const result = sanitizeSmartPlaylistFilter({
            q: ' jazz ',
            minQuality: '27',
            dropme: 'x',
            genre: ''
        });
        expect(result).toEqual({ q: 'jazz', minQuality: 27 });
    });

    it('rejects non-objects and empty filters', () => {
        expect(sanitizeSmartPlaylistFilter(null)).toBeNull();
        expect(sanitizeSmartPlaylistFilter('string')).toBeNull();
        expect(sanitizeSmartPlaylistFilter({})).toBeNull();
        expect(sanitizeSmartPlaylistFilter({ q: '  ' })).toBeNull();
    });
});

describe('buildTrackFilterSql', () => {
    it('builds parameterized clauses with no string interpolation', () => {
        const { sql, params } = buildTrackFilterSql({
            q: 'a%b',
            genre: 'Jazz',
            minQuality: 27
        });
        expect(sql).toContain("title LIKE ? ESCAPE '\\'");
        expect(sql).toContain('genre = ?');
        expect(sql).toContain('quality >= ?');
        expect(params).toEqual(['%a\\%b%', '%a\\%b%', '%a\\%b%', 'Jazz', 27]);
        expect(sql).not.toContain('a%b');
        expect(sql).not.toContain('Jazz');
    });

    it('returns empty WHERE for empty filter', () => {
        const { sql, params } = buildTrackFilterSql({});
        expect(sql).toBe('');
        expect(params).toEqual([]);
    });
});