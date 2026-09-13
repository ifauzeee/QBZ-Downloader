import fs from 'fs';
import path from 'path';
import { watch } from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { libraryScannerService } from './library-scanner/index.js';

const DEBOUNCE_MS = 3000;

export class LibraryWatcher {
    private watcher: FSWatcher | null = null;
    private timer: NodeJS.Timeout | null = null;
    private pendingPaths = new Set<string>();

    start(): void {
        if (this.watcher) return;

        const root = CONFIG.download.outputDir;
        if (!root || !fs.existsSync(root)) {
            logger.warn('LibraryWatcher: downloads directory not found, watcher disabled', 'WATCHER');
            return;
        }

        this.watcher = watch(root, {
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 2000 },
            ignored: (targetPath) => /[\\/]\.[^\\/]+$/.test(targetPath)
        });

        this.watcher.on('all', (_event, filePath) => {
            const ext = path.extname(filePath).toLowerCase();
            if (!libraryScannerService.supportedFormats.includes(ext)) return;

            this.pendingPaths.add(filePath);
            this.scheduleScan();
        });

        logger.info(`LibraryWatcher: watching ${root}`, 'WATCHER');
    }

    private scheduleScan(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.runScan(), DEBOUNCE_MS);
    }

    private runScan(): void {
        this.timer = null;
        const count = this.pendingPaths.size;
        this.pendingPaths.clear();

        if (libraryScannerService.isScanInProgress()) {
            logger.debug(
                `LibraryWatcher: ${count} change(s) detected but a scan is already running`,
                'WATCHER'
            );
            return;
        }

        logger.info(`LibraryWatcher: ${count} file change(s), starting delta scan`, 'WATCHER');
        libraryScannerService
            .scanLibrary(undefined, { deep: false, detectDuplicates: false })
            .then((result) =>
                logger.info(
                    `LibraryWatcher: auto-scan finished (${result.scannedFiles} processed)`,
                    'WATCHER'
                )
            )
            .catch((error: unknown) =>
                logger.error(
                    `LibraryWatcher scan failed: ${(error as Error).message}`,
                    'WATCHER'
                )
            );
    }

    async stop(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
        this.pendingPaths.clear();
    }
}

export const libraryWatcher = new LibraryWatcher();