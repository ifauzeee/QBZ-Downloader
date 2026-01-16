#!/usr/bin/env node

import 'dotenv/config';
import { dashboardService } from './services/dashboard/index.js';
import { queueProcessor } from './services/queue-processor.js';
import { historyService } from './services/history.js';
import { validateEnvironment, displayEnvWarnings } from './utils/env.js';
import { logger } from './utils/logger.js';
import figlet from 'figlet';
import gradient from 'gradient-string';

async function gracefulShutdown(signal: string) {
    console.log('');
    logger.system(`Received ${signal} signal. Initiating graceful shutdown...`, 'SYSTEM');

    try {
        const { databaseService } = await import('./services/database/index.js');
        databaseService.close();
        logger.info('Database connection closed.', 'DB');
    } catch {}

    historyService.flush();
    logger.info('History buffers flushed to storage.', 'STORAGE');

    dashboardService.stop();
    logger.info('Dashboard service terminated.', 'WEB');

    logger.success('System shutdown sequence completed successfully.', 'SYSTEM');
    process.exit(0);
}

function displayBanner() {
    console.clear();
    const title = figlet.textSync('QBZ-DL v3.0', {
        font: 'Slant',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });

    console.log(gradient.pastel.multiline(title));
    console.log(gradient.pastel('  Premium High-Res Audio Downloader & Manager\n'));
    console.log(gradient.cristal('  Developed by Muhammad Ibnu Fauzi\n'));

    logger.system('Initializing application components...', 'BOOT');
}

async function main() {
    try {
        displayBanner();

        logger.info('Validating environment configuration...', 'ENV');
        const { warnings, valid, missing } = validateEnvironment();

        if (warnings.length > 0) {
            displayEnvWarnings(warnings);
        }

        if (!valid) {
            logger.warn(`Missing required credentials: ${missing?.join(', ')}`, 'AUTH');
            logger.info(
                'Please configure your credentials via the Web Dashboard settings.',
                'CONFIG'
            );
        } else {
            logger.success('Environment configuration validated.', 'ENV');
        }

        logger.info('Initializing Database Service...', 'DB');
        try {
            const { databaseService } = await import('./services/database/index.js');
            databaseService.initialize();
            logger.success('Database service initialized.', 'DB');
        } catch (error: any) {
            logger.warn(`Database init skipped: ${error.message}`, 'DB');
        }

        logger.info('Starting Queue Processor...', 'QUEUE');
        queueProcessor.start();
        logger.success('Queue Processor active and listening.', 'QUEUE');

        logger.info('Initializing Dashboard Service...', 'WEB');
        dashboardService.start();

        logger.success('System initialization complete. Waiting for commands.', 'SYSTEM');

        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

        process.on('uncaughtException', (error) => {
            logger.error(`Uncaught Exception detected: ${error.message}`, 'FATAL');
            gracefulShutdown('uncaughtException');
        });

        process.on('unhandledRejection', (reason) => {
            logger.error(`Unhandled Promise Rejection: ${reason}`, 'FATAL');
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`Fatal system error during startup: ${message}`, 'BOOT');
        process.exit(1);
    }
}

main();
