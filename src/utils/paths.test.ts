import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG = {
    download: { outputDir: '' },
    export: { outputDir: '' }
};

vi.mock('../config.js', () => ({ CONFIG }));

const { isPathWithinManagedRoots, getManagedRoots } = await import('./paths.js');

describe('isPathWithinManagedRoots', () => {
    let root: string;
    let outside: string;

    beforeEach(() => {
        root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qbz-lib-')));
        outside = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'qbz-out-')));
        CONFIG.download.outputDir = root;
        CONFIG.export.outputDir = '';
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
        fs.rmSync(outside, { recursive: true, force: true });
    });

    it('accepts a file inside the library', () => {
        const file = path.join(root, 'Artist', 'Album', '01. Track.flac');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'x');
        expect(isPathWithinManagedRoots(file)).toBe(true);
    });

    it('accepts a not-yet-created file inside the library', () => {
        expect(isPathWithinManagedRoots(path.join(root, 'new', 'file.flac'))).toBe(true);
    });

    it('rejects an arbitrary absolute path', () => {
        // The reported attack: DELETE /api/library/file with someone's private key.
        expect(isPathWithinManagedRoots(path.join(os.homedir(), '.ssh', 'id_rsa'))).toBe(false);
        expect(isPathWithinManagedRoots('/etc/passwd')).toBe(false);
    });

    it('rejects traversal that climbs out of the library', () => {
        expect(isPathWithinManagedRoots(path.join(root, '..', '..', 'etc', 'passwd'))).toBe(false);
    });

    it('rejects a sibling directory sharing the root prefix', () => {
        expect(isPathWithinManagedRoots(`${root}-backup/track.flac`)).toBe(false);
    });

    it('rejects a symlink inside the library that points outside it', () => {
        const secret = path.join(outside, 'secret.txt');
        fs.writeFileSync(secret, 'x');
        const link = path.join(root, 'escape.flac');
        fs.symlinkSync(secret, link);

        expect(isPathWithinManagedRoots(link)).toBe(false);
    });

    it('rejects empty and non-string input', () => {
        expect(isPathWithinManagedRoots('')).toBe(false);
        expect(isPathWithinManagedRoots('   ')).toBe(false);
        expect(isPathWithinManagedRoots(undefined)).toBe(false);
        expect(isPathWithinManagedRoots(null)).toBe(false);
        expect(isPathWithinManagedRoots(42)).toBe(false);
    });

    it('also accepts files under the export directory when one is configured', () => {
        CONFIG.export.outputDir = outside;
        expect(getManagedRoots()).toHaveLength(2);
        expect(isPathWithinManagedRoots(path.join(outside, 'converted.mp3'))).toBe(true);
    });
});
