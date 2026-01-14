#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { registerDownloadCommand } from './commands/download.js';
import { registerSearchCommand } from './commands/search.js';
import { registerInfoCommand } from './commands/info.js';
import { registerLyricsCommand } from './commands/lyrics.js';
import { registerAccountCommand } from './commands/account.js';
import { registerQualityCommand } from './commands/quality.js';
import { registerSetupCommand } from './commands/setup.js';
import { registerBotCommand } from './commands/bot.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { showMainMenu } from './commands/menu.js';
import * as display from './utils/display.js';
import { validateEnvironment, displayEnvWarnings } from './utils/env.js';
import { handleError } from './utils/errors.js';
import { APP_VERSION } from './constants.js';
import { settingsService } from './services/settings.js';
import { runSetup } from './commands/setup.js';
import { displayBanner } from './utils/display.js';

const isMetaCommand =
    process.argv.includes('--help') ||
    process.argv.includes('-h') ||
    process.argv.includes('--version') ||
    process.argv.includes('-V') ||
    process.argv.includes('quality') ||
    process.argv.includes('q');

let warnings: string[] = [];
if (!isMetaCommand) {
    const result = validateEnvironment();
    warnings = result.warnings;
}

const program = new Command();

program
    .name('qobuz-dl')
    .description('🎵 Premium Qobuz Downloader CLI - Hi-Res Audio with Complete Metadata & Lyrics')
    .version(APP_VERSION);

registerDownloadCommand(program);
registerSearchCommand(program);
registerInfoCommand(program);
registerLyricsCommand(program);
registerAccountCommand(program);
registerQualityCommand(program);
registerSetupCommand(program);
registerBotCommand(program);
registerDashboardCommand(program);

program.exitOverride();

const hasCommand = process.argv.length > 2;
const isSetupCommand = process.argv[2] === 'setup';

async function main() {
    try {
        if (!settingsService.isConfigured() && !isSetupCommand && !isMetaCommand) {
            displayBanner();
            console.log(chalk.yellow('\n⚠️  Application is not configured yet!'));
            const { proceed } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Would you like to run the setup wizard now?',
                    default: true
                }
            ]);

            if (proceed) {
                await runSetup();
            } else {
                console.log(
                    chalk.red('\nPlease run "qobuz-dl setup" to configure the app before use.')
                );
                process.exit(1);
            }
        }

        if (hasCommand) {
            await program.parseAsync(process.argv);
        } else {
            displayEnvWarnings(warnings);
            await showMainMenu();
        }
    } catch (error: unknown) {
        const err = error as any;
        if (
            err.exitCode === 0 ||
            err.code === 'commander.help' ||
            err.code === 'commander.version'
        ) {
            process.exit(0);
        }
        handleError(error as Error, display);
        process.exit(1);
    }
}

main();
