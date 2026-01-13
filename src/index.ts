#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { registerDownloadCommand } from './commands/download.js';
import { registerSearchCommand } from './commands/search.js';
import { registerInfoCommand } from './commands/info.js';
import { registerLyricsCommand } from './commands/lyrics.js';
import { registerAccountCommand } from './commands/account.js';
import { registerQualityCommand } from './commands/quality.js';
import { registerSetupCommand } from './commands/setup.js';
import { showMainMenu } from './commands/menu.js';
import * as display from './utils/display.js';
import { validateEnvironment, displayEnvWarnings } from './utils/env.js';
import { handleError } from './utils/errors.js';
import { APP_VERSION } from './constants.js';

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

program.action(async () => {
    displayEnvWarnings(warnings);
    await showMainMenu();
});

program.exitOverride();

const hasCommand = process.argv.length > 2;

async function main() {
    try {
        if (hasCommand) {
            await program.parseAsync(process.argv);
        } else {
            displayEnvWarnings(warnings);
            await showMainMenu();
        }
    } catch (error: any) {
        if (
            error.exitCode === 0 ||
            error.code === 'commander.help' ||
            error.code === 'commander.version'
        ) {
            process.exit(0);
        }
        handleError(error, display);
        process.exit(1);
    }
}

main();
