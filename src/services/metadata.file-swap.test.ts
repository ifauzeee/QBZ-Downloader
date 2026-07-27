import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import { MetadataService } from './metadata.js';

// ffmpeg is simulated: it writes a plausible output file at the path given as the
// final argument. The point of this suite is the *file swap* around that call --
// the step that replaces the user's original track with the tagged copy -- which
// every other test mocks away behind vi.mock('fs').
type ExecFileCallback = (error: Error | null, stdout: string, stderr: string) => void;

vi.mock('child_process', async () => {
    const realFs = await vi.importActual<typeof import('fs')>('fs');
    return {
        execFile: vi.fn((_file: string, args: string[], _opts: unknown, cb: ExecFileCallback) => {
            realFs.writeFileSync(args[args.length - 1]!, Buffer.alloc(4096, 7));
            cb(null, '', '');
        })
    };
});

vi.mock('../utils/binaries.js', () => ({
    resolveBinaryPath: vi.fn(() => 'ffmpeg')
}));

vi.mock('../utils/logger.js', () => ({
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

const ORIGINAL_CONTENT = Buffer.alloc(2048, 42);
const TAGS = [['TITLE', 'T'], ['ARTIST', 'A']];

describe('writeFlacTags file swap', () => {
    let service: MetadataService;
    let dir: string;
    let track: string;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new MetadataService();
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qbz-swap-'));
        track = path.join(dir, 'track.flac');
        fs.writeFileSync(track, ORIGINAL_CONTENT);
    });

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true });
    });

    it('replaces the original with the tagged file and leaves no temp files behind', async () => {
        await service.writeFlacTags(track, TAGS);

        expect(fs.existsSync(track)).toBe(true);
        expect(fs.readFileSync(track).equals(ORIGINAL_CONTENT)).toBe(false);
        expect(fs.readdirSync(dir)).toEqual(['track.flac']);
    });

    it('keeps the original when the tagged file cannot be moved into place', async () => {
        // Fail the move of the tagged temp file into place -- an SMB lock or a
        // transient EPERM at exactly the wrong moment. Backing the original up
        // first means it can be restored; the previous order unlinked it before
        // this rename, so the failure left no copy of the track on disk at all.
        const realRename = fs.renameSync;
        const spy = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
            if (String(from).endsWith('.tmp')) throw new Error('EPERM: rename blocked');
            return realRename(from, to);
        });

        await expect(service.writeFlacTags(track, TAGS)).rejects.toThrow('EPERM: rename blocked');

        expect(fs.existsSync(track)).toBe(true);
        expect(fs.readFileSync(track).equals(ORIGINAL_CONTENT)).toBe(true);
        spy.mockRestore();
    });

    it('keeps the original untouched when ffmpeg fails', async () => {
        vi.mocked(execFile).mockImplementationOnce(((
            _file: string,
            _args: string[],
            _opts: unknown,
            cb: ExecFileCallback
        ) => {
            cb(new Error('exited 1'), '', 'Unable to find a suitable output format');
        }) as unknown as typeof execFile);

        await expect(service.writeFlacTags(track, TAGS)).rejects.toThrow('ffmpeg tagging failed');

        expect(fs.existsSync(track)).toBe(true);
        expect(fs.readFileSync(track).equals(ORIGINAL_CONTENT)).toBe(true);
        expect(fs.readdirSync(dir)).toEqual(['track.flac']);
    });
});
