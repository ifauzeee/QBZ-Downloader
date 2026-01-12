import inquirer from 'inquirer';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import * as display from '../utils/display.js';
import { downloadAlbumInteractive, downloadTrackInteractive } from './download.js';
import { handleSearch } from './search.js';
import { handleAccount } from './account.js';

const api = new QobuzAPI();

export async function showMainMenu() {
    display.displayBanner();

    let running = true;
    while (running) {
        console.log(chalk.bold.cyan('\n📋 Main Menu:\n'));
        console.log(chalk.white('  1) 🔍 Search Music'));
        console.log(chalk.white('  2) 📥 Download by URL'));
        console.log(chalk.white('  3) 👤 Account Info'));
        console.log(chalk.white('  4) 🎚️ Quality Options'));
        console.log(chalk.white('  5) ❌ Exit'));
        console.log();

        const mainChoice = await inquirer.prompt([
            {
                type: 'input',
                name: 'action',
                message: chalk.cyan('Enter your choice (1-5):'),
                validate: (input) => {
                    const num = parseInt(input);
                    if (num >= 1 && num <= 5) return true;
                    return 'Please enter a number between 1 and 5';
                }
            }
        ]);

        const actionMap = { 1: 'search', 2: 'download', 3: 'account', 4: 'quality', 5: 'exit' };
        const action = actionMap[mainChoice.action];

        if (action === 'exit') {
            console.log(chalk.yellow('\n👋 Goodbye! Happy listening! 🎧\n'));
            process.exit(0);
        }

        if (action === 'search') {
            await handleSearch();
        } else if (action === 'download') {
            await handleDownload();
        } else if (action === 'account') {
            await handleAccount();
        } else if (action === 'quality') {
            display.displayQualityOptions();
            console.log();
        }
    }
}

async function handleDownload() {
    const urlAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'url',
            message: chalk.cyan('🔗 Enter Qobuz URL or Album/Track ID:'),
            validate: (input) => input.length > 0 || 'Please enter a valid URL'
        }
    ]);

    const parsed = api.parseUrl(urlAnswer.url);
    if (!parsed) {
        display.displayError('Invalid Qobuz URL. Please provide a valid album or track URL.');
        return;
    }

    if (parsed.type === 'album') {
        await downloadAlbumInteractive(parsed.id);
    } else if (parsed.type === 'track') {
        await downloadTrackInteractive(parsed.id);
    }
}
