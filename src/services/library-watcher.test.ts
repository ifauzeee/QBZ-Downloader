import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => {
    const fakeClose = vi.fn().mockResolvedValue(undefined);
    const scanLibrary = vi.fn().mockResolvedValue({ scannedFiles: 1 });
    const isScanInProgress = vi.fn().mockReturnValue(false);
    return {
        fakeClose,
        scanLibrary,
        isScanInProgress,
        handler: null as null | ((event: string, filePath: string) => void)
    };
});

vi.mock('chokidar', () => ({
    watch: vi.fn(() => {
        const w = {
            on: vi.fn((_event: string, cb: (e: string, p: string) => void) => {
                h.handler = cb;
                return w;
            }),
            close: h.fakeClose
        };
        return w;
    })
}));

vi.mock('../config.js', () => ({
    CONFIG: { download: { outputDir: process.cwd() } }
}));

vi.mock('../utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

vi.mock('./library-scanner/index.js', () => ({
    libraryScannerService: {
        scanLibrary: h.scanLibrary,
        isScanInProgress: h.isScanInProgress,
        supportedFormats: ['.flac', '.mp3']
    }
}));

import { LibraryWatcher } from './LibraryWatcher.js';

const trigger = (event: string, filePath: string) => {
    if (!h.handler) throw new Error('watcher handler not registered');
    h.handler(event, filePath);
};

describe('LibraryWatcher', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        h.scanLibrary.mockClear();
        h.isScanInProgress.mockClear();
        h.isScanInProgress.mockReturnValue(false);
        h.fakeClose.mockClear();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('debounces a burst of changes into one delta scan', async () => {
        new LibraryWatcher().start();

        trigger('add', 'a.flac');
        trigger('change', 'b.flac');
        trigger('add', 'c.mp3');

        await vi.advanceTimersByTimeAsync(2999);
        expect(h.scanLibrary).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(h.scanLibrary).toHaveBeenCalledTimes(1);
        expect(h.scanLibrary).toHaveBeenCalledWith(undefined, {
            deep: false,
            detectDuplicates: false
        });
    });

    it('ignores unsupported extensions', async () => {
        new LibraryWatcher().start();

        trigger('add', 'notes.txt');
        trigger('add', 'album.log');

        await vi.advanceTimersByTimeAsync(5000);
        expect(h.scanLibrary).not.toHaveBeenCalled();
    });

    it('skips the scan when one is already running', async () => {
        h.isScanInProgress.mockReturnValue(true);
        new LibraryWatcher().start();

        trigger('add', 'x.flac');
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.scanLibrary).not.toHaveBeenCalled();
    });

    it('stop() closes the watcher', async () => {
        const watcher = new LibraryWatcher();
        watcher.start();
        await watcher.stop();
        expect(h.fakeClose).toHaveBeenCalled();
    });
});