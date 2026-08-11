import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';

const require = createRequire(import.meta.url);
const { __test } = require('./adhoc-sign-mac.cjs');
const { isMachO } = __test;

/**
 * The predicate this covers used to compare a 4-byte file header against a flat
 * 16-byte list of four alternative magics, so it returned false for every file
 * on disk. The signing hook consequently signed zero binaries and shipped a
 * macOS bundle with no valid signature, which Gatekeeper reports as "damaged".
 */
describe('adhoc-sign-mac isMachO', () => {
    let dir;

    const write = (name, bytes) => {
        const file = path.join(dir, name);
        fs.writeFileSync(file, Buffer.from(bytes));
        return file;
    };

    beforeAll(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbz-macho-'));
    });

    afterAll(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it.each([
        ['MH_MAGIC_64', [0xcf, 0xfa, 0xed, 0xfe]],
        ['MH_CIGAM_64', [0xfe, 0xed, 0xfa, 0xcf]],
        ['FAT_MAGIC', [0xca, 0xfe, 0xba, 0xbe]],
        ['FAT_CIGAM', [0xbe, 0xba, 0xfe, 0xca]]
    ])('recognises %s', (_name, magic) => {
        expect(isMachO(write(`macho-${_name}`, [...magic, 0x00, 0x01, 0x02, 0x03]))).toBe(true);
    });

    it('rejects a non-Mach-O file', () => {
        expect(isMachO(write('text', [0x68, 0x65, 0x6c, 0x6c, 0x6f]))).toBe(false);
    });

    it('rejects a file shorter than the magic', () => {
        expect(isMachO(write('tiny', [0xcf, 0xfa]))).toBe(false);
    });

    it('rejects a path that does not exist', () => {
        expect(isMachO(path.join(dir, 'missing'))).toBe(false);
    });

    it('recognises the real Electron binary shipped in node_modules', () => {
        const electronPath = path.resolve(
            path.dirname(new URL(import.meta.url).pathname),
            '..',
            'node_modules',
            'electron',
            'dist',
            'Electron.app',
            'Contents',
            'MacOS',
            'Electron'
        );

        // Only meaningful on a macOS checkout with electron installed.
        if (process.platform !== 'darwin' || !fs.existsSync(electronPath)) return;
        expect(isMachO(electronPath)).toBe(true);
    });
});
