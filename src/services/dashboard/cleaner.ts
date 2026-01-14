import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger.js';
import { CONFIG } from '../../config.js';
import { historyService } from '../history.js';

export class DashboardCleaner {
    private interval: NodeJS.Timeout | null = null;
    private hours: number;

    constructor(hours: number = 24) {
        this.hours = hours;
    }

    start() {
        if (this.hours <= 0) return;

        logger.info(`Dashboard cleaner started. Files will be deleted after ${this.hours} hours.`);

        this.interval = setInterval(() => this.cleanup(), 60 * 60 * 1000);

        this.cleanup();
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async cleanup() {
        logger.debug('Running dashboard cleanup...');
        const now = Date.now();
        const maxAge = this.hours * 60 * 60 * 1000;

        const history = historyService.getAll();
        const deletedIds: string[] = [];

        for (const [id, entry] of Object.entries(history)) {
            if (!entry.filename) continue;

            const filePath = entry.filename;
            if (!fs.existsSync(filePath)) continue;

            try {
                const stats = fs.statSync(filePath);
                const age = now - stats.mtimeMs;

                if (age > maxAge) {
                    logger.info(
                        `Auto-cleaning: Deleting ${path.basename(filePath)} (${Math.round(age / 3600000)}h old)`
                    );

                    if (fs.lstatSync(filePath).isDirectory()) {
                        fs.rmSync(filePath, { recursive: true, force: true });
                    } else {
                        fs.unlinkSync(filePath);
                    }

                    deletedIds.push(id);
                }
            } catch (err) {
                logger.error(`Failed to auto-clean ${filePath}: ${err}`);
            }
        }
    }
}

export const dashboardCleaner = new DashboardCleaner(CONFIG.dashboard.autoCleanHours);
