import { describe, it, expect } from 'vitest';
import { handleError } from './errors.js';

describe('Error Utilities', () => {
    it('should be defined', () => {
        expect(handleError).toBeDefined();
    });
});
