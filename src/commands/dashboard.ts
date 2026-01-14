import { Command } from 'commander';
import { dashboardService } from '../services/dashboard/index.js';
import { telegramService } from '../services/telegram/index.js';
import { logger } from '../utils/logger.js';
import boxen from 'boxen';
import chalk from 'chalk';

export function registerDashboardCommand(program: Command) {
    program
        .command('dashboard')
        .alias('web')
        .description('Start the Web Dashboard interface')
        .option('-p, --port <number>', 'Port to run the dashboard on', '3000')
        .action(async (options) => {
            const port = parseInt(options.port, 10);
            console.log(
                boxen(
                    chalk.blue('  🎵 QBZ-Downloader Dashboard  \n') +
                    chalk.white('  Web Interface for Queue Management'),
                    { padding: 1, borderStyle: 'round', borderColor: 'blue' }
                )
            );

            if (telegramService.isEnabled()) {
                logger.info('Starting Telegram Bot Service (handling queue)...');
                telegramService.startBot().catch((_err) => {
                    logger.error(
                        'Failed to start Telegram Bot. Falling back to headless processor.'
                    );
                    import('../services/queue-processor.js').then(({ queueProcessor }) => {
                        queueProcessor.start();
                    });
                });
            } else {
                logger.info('Telegram Bot disabled. Starting headless queue processor.');
                const { queueProcessor } = await import('../services/queue-processor.js');
                queueProcessor.start();
            }

            dashboardService.start(port);

            process.on('SIGINT', () => {
                logger.info('Stopping dashboard...');
                dashboardService.stop();
                process.exit(0);
            });
        });
}
