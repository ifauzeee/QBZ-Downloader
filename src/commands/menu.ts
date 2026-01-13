import inquirer from 'inquirer';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import * as ui from '../utils/ui.js';
import {
    downloadAlbumInteractive,
    downloadTrackInteractive,
    downloadPlaylistInteractive,
    downloadArtistInteractive
} from './download.js';
import { handleSearch } from './search.js';
import { handleAccount } from './account.js';
import { handleSettings } from './settings.js';
import { COLORS, SYMBOLS } from '../utils/theme.js';

const api = new QobuzAPI();

export async function showMainMenu() {
    ui.printLogo();

    const running = true;
    while (running) {
        const choices = [
            { name: `${SYMBOLS.music}  Download (Auto-Detect URL)`, value: 'download_smart' },
            { name: '🔍  Search Library', value: 'search' },
            { name: '👤  My Account', value: 'account' },
            { name: '⚙️   Settings', value: 'settings' },
            new inquirer.Separator(),
            { name: `${SYMBOLS.error}  Exit`, value: 'exit' }
        ];

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: chalk.hex(COLORS.primary)('What would you like to do?'),
                choices: choices,
                pageSize: 10
            }
        ]);

        if (action === 'exit') {
            console.log(chalk.gray('\nSee you next time! 👋\n'));
            process.exit(0);
        }

        try {
            switch (action) {
                case 'download_smart':
                    await handleSmartDownload();
                    break;
                case 'search':
                    await handleSearch();
                    break;
                case 'account':
                    await handleAccount();
                    break;
                case 'settings':
                    await handleSettings();
                    break;
            }
        } catch (error: unknown) {
            console.error(chalk.red('Failed to fetch user info:'), (error as Error).message);
        }

        console.log();
    }
}

async function handleSmartDownload() {
    ui.printHeader('Smart Download');
    console.log(
        chalk.gray(
            'Paste a Qobuz link (Track, Album, Artist, Playlist) or just press Enter to go back.'
        )
    );

    const { input } = await inquirer.prompt([
        {
            type: 'input',
            name: 'input',
            message: chalk.cyan('🔗 Link / ID:'),
            validate: (input: string) => {
                if (!input) return true;
                if (!input.includes('qobuz.com') && !/^\d+$/.test(input)) {
                    return 'This does not look like a valid Qobuz URL or ID.';
                }
                return true;
            }
        }
    ]);

    if (!input) return;

    if (!input.includes('qobuz.com') && !/^\d+$/.test(input)) {
        const { confirmSearch } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmSearch',
                message: `This doesn't look like a URL. Search for "${input}" instead?`,
                default: true
            }
        ]);

        if (confirmSearch) {
            ui.printInfo('Please use the Search option for keywords.');
        }
        return;
    }

    const parsed = api.parseUrl(input);
    if (!parsed) {
        ui.printError('Invalid URL or ID format.');
        return;
    }

    try {
        switch (parsed.type) {
            case 'album':
                await downloadAlbumInteractive(parsed.id);
                break;
            case 'track':
                await downloadTrackInteractive(parsed.id);
                break;
            case 'playlist':
                await downloadPlaylistInteractive(parsed.id);
                break;
            case 'artist':
                await downloadArtistInteractive(parsed.id);
                break;
        }
    } catch (e: unknown) {
        ui.printError((e as Error).message);
    }

    await inquirer.prompt([
        { type: 'input', name: 'wait', message: chalk.gray('Press Enter to return to menu...') }
    ]);
}
