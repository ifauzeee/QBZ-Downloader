import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from './validator.js';

describe('InputValidator', () => {
    let validator: InputValidator;

    beforeEach(() => {
        validator = new InputValidator();
    });

    describe('validateUrl', () => {
        it('should validate album URL', () => {
            const result = validator.validateUrl('https://play.qobuz.com/album/0886449663033');
            expect(result.valid).toBe(true);
            expect(result.type).toBe('album');
            expect(result.id).toBe('0886449663033');
        });

        it('should validate track URL', () => {
            const result = validator.validateUrl('https://play.qobuz.com/track/123456789');
            expect(result.valid).toBe(true);
            expect(result.type).toBe('track');
            expect(result.id).toBe('123456789');
        });

        it('should validate playlist URL', () => {
            const result = validator.validateUrl('https://play.qobuz.com/playlist/12345');
            expect(result.valid).toBe(true);
            expect(result.type).toBe('playlist');
        });

        it('should validate localized URLs', () => {
            const result = validator.validateUrl('https://www.qobuz.com/us-en/album/test/123');
            expect(result.valid).toBe(true);
        });

        it('should reject non-Qobuz URLs', () => {
            const result = validator.validateUrl('https://spotify.com/track/123');
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Not a Qobuz');
        });

        it('should reject empty URL', () => {
            const result = validator.validateUrl('');
            expect(result.valid).toBe(false);
        });

        it('should reject URL with script tags', () => {
            const result = validator.validateUrl(
                'https://play.qobuz.com/album/<script>alert(1)</script>'
            );
            expect(result.valid).toBe(false);
        });

        it('should reject URL with javascript protocol', () => {
            const result = validator.validateUrl('javascript:alert(1)');
            expect(result.valid).toBe(false);
        });

        it('should reject very long URLs', () => {
            const longUrl = 'https://play.qobuz.com/album/' + 'a'.repeat(600);
            const result = validator.validateUrl(longUrl);
            expect(result.valid).toBe(false);
        });

        it('should handle URL encoded injection attempts', () => {
            const result = validator.validateUrl('https://play.qobuz.com/album/123%3Cscript%3E');
            expect(result.valid).toBe(false);
        });
    });

    describe('validateQuery', () => {
        it('should validate simple query', () => {
            const result = validator.validateQuery('Daft Punk');
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe('Daft Punk');
        });

        it('should validate unicode characters', () => {
            const result = validator.validateQuery('日本語 音楽');
            expect(result.valid).toBe(true);
        });

        it('should trim whitespace', () => {
            const result = validator.validateQuery('  test query  ');
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe('test query');
        });

        it('should normalize multiple spaces', () => {
            const result = validator.validateQuery('test    query');
            expect(result.valid).toBe(true);
            expect(result.sanitized).toBe('test query');
        });

        it('should reject empty query', () => {
            const result = validator.validateQuery('');
            expect(result.valid).toBe(false);
        });

        it('should reject too short query', () => {
            const result = validator.validateQuery('a');
            expect(result.valid).toBe(false);
        });

        it('should reject too long query', () => {
            const result = validator.validateQuery('a'.repeat(300));
            expect(result.valid).toBe(false);
        });

        it('should reject query with HTML tags', () => {
            const result = validator.validateQuery('<script>alert(1)</script>');
            expect(result.valid).toBe(false);
        });

        it('should remove dangerous characters', () => {
            const result = validator.validateQuery('test "query" <with> \'quotes\'');
            expect(result.valid).toBe(true);
            expect(result.sanitized).not.toContain('<');
            expect(result.sanitized).not.toContain('>');
            expect(result.sanitized).not.toContain('"');
            expect(result.sanitized).not.toContain("'");
        });
    });

    describe('validateQuality', () => {
        it('should validate valid quality numbers', () => {
            expect(validator.validateQuality(5)).toBe(true);
            expect(validator.validateQuality(6)).toBe(true);
            expect(validator.validateQuality(7)).toBe(true);
            expect(validator.validateQuality(27)).toBe(true);
        });

        it('should validate quality strings', () => {
            expect(validator.validateQuality('5')).toBe(true);
            expect(validator.validateQuality('27')).toBe(true);
        });

        it('should validate special quality values', () => {
            expect(validator.validateQuality('ask')).toBe(true);
            expect(validator.validateQuality('min')).toBe(true);
            expect(validator.validateQuality('max')).toBe(true);
        });

        it('should reject invalid quality values', () => {
            expect(validator.validateQuality(0)).toBe(false);
            expect(validator.validateQuality(10)).toBe(false);
            expect(validator.validateQuality('invalid')).toBe(false);
        });
    });

    describe('isValidId', () => {
        it('should validate alphanumeric IDs', () => {
            expect(validator.isValidId('123456789')).toBe(true);
            expect(validator.isValidId('abc123')).toBe(true);
            expect(validator.isValidId('ABC123xyz')).toBe(true);
        });

        it('should accept numeric IDs', () => {
            expect(validator.isValidId(123456789)).toBe(true);
        });

        it('should reject IDs with special characters', () => {
            expect(validator.isValidId('123-456')).toBe(false);
            expect(validator.isValidId('abc_123')).toBe(false);
            expect(validator.isValidId('test.id')).toBe(false);
        });

        it('should reject empty IDs', () => {
            expect(validator.isValidId('')).toBe(false);
        });

        it('should reject very long IDs', () => {
            expect(validator.isValidId('a'.repeat(100))).toBe(false);
        });
    });

    describe('isValidUserId', () => {
        it('should validate numeric user IDs', () => {
            expect(validator.isValidUserId('123456789')).toBe(true);
            expect(validator.isValidUserId(123456789)).toBe(true);
        });

        it('should reject non-numeric user IDs', () => {
            expect(validator.isValidUserId('abc123')).toBe(false);
            expect(validator.isValidUserId('user-123')).toBe(false);
        });
    });

    describe('sanitizeForDisplay', () => {
        it('should escape HTML entities', () => {
            const result = validator.sanitizeForDisplay('<script>alert("xss")</script>');
            expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('should escape ampersands', () => {
            const result = validator.sanitizeForDisplay('Tom & Jerry');
            expect(result).toBe('Tom &amp; Jerry');
        });

        it('should handle empty strings', () => {
            expect(validator.sanitizeForDisplay('')).toBe('');
        });

        it('should handle null/undefined', () => {
            expect(validator.sanitizeForDisplay(null as any)).toBe('');
            expect(validator.sanitizeForDisplay(undefined as any)).toBe('');
        });
    });
});
