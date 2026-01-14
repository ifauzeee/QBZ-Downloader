import { Command } from 'commander';
import { telegramService } from '../services/telegram/index.js';
import * as display from '../utils/display.js';

export function registerBotCommand(program: Command) {
    program
        .command('bot')
        .description('Start the Telegram Bot in persistent mode')
        .action(async () => {
            display.displayBanner();
            await telegramService.startBot();
        });
}
