import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveWebMode, WEB_MODE_KEY } from './webMode.js';

// resolveWebMode only reads window.location.search and window.localStorage, so a
// small stub covers it without pulling in a DOM implementation.
function stubWindow(search: string, store: Record<string, string> = {}, throwOnAccess = false) {
    (globalThis as { window?: unknown }).window = {
        location: { search },
        localStorage: {
            getItem: (key: string) => {
                if (throwOnAccess) throw new Error('storage disabled');
                return key in store ? store[key] : null;
            },
            setItem: (key: string, value: string) => {
                if (throwOnAccess) throw new Error('storage disabled');
                store[key] = value;
            },
            removeItem: (key: string) => {
                if (throwOnAccess) throw new Error('storage disabled');
                delete store[key];
            }
        }
    };
    return store;
}

describe('resolveWebMode', () => {
    beforeEach(() => {
        delete (globalThis as { window?: unknown }).window;
    });

    afterEach(() => {
        delete (globalThis as { window?: unknown }).window;
    });

    it('enables web mode when the query string asks for it', () => {
        stubWindow('?mode=web');
        expect(resolveWebMode()).toBe(true);
    });

    it('remembers the choice so a later page without the query still works', () => {
        const store = stubWindow('?mode=web');
        resolveWebMode();

        // What a refresh on /search looks like: same origin, no query string.
        stubWindow('', store);
        expect(resolveWebMode()).toBe(true);
    });

    it('stays disabled when nothing has ever asked for web mode', () => {
        stubWindow('');
        expect(resolveWebMode()).toBe(false);
    });

    it('lets ?mode=desktop turn it back off', () => {
        const store = stubWindow('?mode=web');
        resolveWebMode();

        stubWindow('?mode=desktop', store);
        expect(resolveWebMode()).toBe(false);
        expect(store[WEB_MODE_KEY]).toBeUndefined();

        stubWindow('', store);
        expect(resolveWebMode()).toBe(false);
    });

    it('falls back to the query string when storage is unavailable', () => {
        stubWindow('?mode=web', {}, true);
        expect(resolveWebMode()).toBe(true);

        stubWindow('', {}, true);
        expect(resolveWebMode()).toBe(false);
    });

    it('ignores a mode value that merely contains the word', () => {
        stubWindow('?notmode=website');
        expect(resolveWebMode()).toBe(false);
    });
});
