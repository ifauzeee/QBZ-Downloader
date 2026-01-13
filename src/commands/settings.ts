import inquirer from 'inquirer';
import chalk from 'chalk';
import * as display from '../utils/display.js';
import { settingsService } from '../services/settings.js';

const getSetting = (section: string, key?: string, def?: any) => {
    const sec = settingsService.get(section) as Record<string, any>;
    if (!sec) return def;
    if (!key) return sec;
    return sec[key] !== undefined ? sec[key] : def;
};

const setSetting = (section: string, key: string, value: any) => {
    const sec = (settingsService.get(section) as Record<string, any>) || {};
    sec[key] = value;
    settingsService.set(section, sec);
};

export async function handleSettings() {
    let inSettings = true;

    while (inSettings) {
        console.clear();
        display.displayBanner();

        const qual = getSetting('quality', 'default', 27);
        let qualityText = 'Unknown';
        if (qual === 'max' || qual === 27) qualityText = chalk.green('Hi-Res (Max)');
        else if (qual === 'min' || qual === 5) qualityText = chalk.yellow('MP3 (Min)');
        else if (qual === 'ask') qualityText = chalk.hex('#FFA500')('Always Ask');
        else qualityText = String(qual);

        const dlPath = getSetting('downloads', 'path', './downloads');
        const dlConc = getSetting('downloads', 'concurrent', 4);

        const metaLyrics = getSetting('metadata', 'embedLyrics', true)
            ? chalk.green('Yes')
            : chalk.red('No');
        const metaCover = getSetting('metadata', 'embedCover', true)
            ? chalk.green('Yes')
            : chalk.red('No');
        const saveCover = getSetting('metadata', 'saveCoverFile', false)
            ? chalk.green('Yes')
            : chalk.red('No');

        const dispColor = getSetting('display', 'colorScheme', 'gradient');
        const tgUpload = getSetting('telegram', 'uploadFiles', true)
            ? chalk.green('Yes')
            : chalk.red('No');

        console.log(chalk.bold.cyan('\n⚙️  Settings & Configuration:\n'));

        console.log(chalk.bold.white('  1) 🎚️  Download Quality'));
        console.log(chalk.gray(`     Current: ${qualityText}`));

        console.log(chalk.bold.white('  2) 📁 Download Options'));
        console.log(chalk.gray(`     Path: ${dlPath} | Concurrency: ${dlConc}`));

        console.log(chalk.bold.white('  3) 🏷️  Metadata & Assets'));
        console.log(
            chalk.gray(
                `     Lyrics: ${metaLyrics} | Cover: ${metaCover} | Save Folder.jpg: ${saveCover}`
            )
        );

        console.log(chalk.bold.white('  4) 🎨 Display & Interface'));
        console.log(chalk.gray(`     Theme: ${dispColor}`));

        console.log(chalk.bold.white('  5) 🤖 Telegram Bot'));
        console.log(chalk.gray(`     Auto-Upload: ${tgUpload}`));

        console.log(chalk.bold.white('  6) 🔄 Reset to Default Settings'));
        console.log(chalk.bold.white('  7) 📖 Settings Documentation (Help)'));

        console.log(chalk.bold.red('  0) 🔙 Back to Main Menu'));
        console.log();

        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'action',
                message: chalk.cyan('Select option (0-5):'),
                validate: (input) => {
                    const num = parseInt(input);
                    if (!isNaN(num) && num >= 0 && num <= 7) return true;
                    return 'Please enter a number between 0 and 7';
                }
            }
        ]);

        const choice = parseInt(answer.action);

        switch (choice) {
            case 1:
                await handleQualitySettings();
                break;
            case 2:
                await handleDownloadSettings();
                break;
            case 3:
                await handleMetadataSettings();
                break;
            case 4:
                await handleDisplaySettings();
                break;
            case 5:
                await handleTelegramSettings();
                break;
            case 6:
                await handleResetSettings();
                break;
            case 7:
                await showSettingsHelp();
                break;
            case 0:
                inSettings = false;
                break;
        }
    }
}

async function handleQualitySettings() {
    console.log(chalk.bold.cyan('\n🎚️  Default Download Quality:\n'));

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'quality',
            message: chalk.cyan('Choose default quality preference:'),
            default: getSetting('quality', 'default'),
            choices: [
                { name: '🔥 Always Maximum (Hi-Res 24-bit/192kHz)', value: 27 },
                { name: '✨ Hi-Res (24-bit/96kHz)', value: 7 },
                { name: '💿 CD Quality (16-bit/44.1kHz FLAC)', value: 6 },
                { name: '🎵 MP3 320kbps (Save Space)', value: 5 },
                { name: '❓ Always Ask (Choose per download)', value: 'ask' }
            ]
        }
    ]);

    setSetting('quality', 'default', answer.quality);
    console.log(chalk.green('\n✅ Quality settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleDownloadSettings() {
    console.log(chalk.bold.cyan('\n📁 Download Configuration:\n'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'path',
            message: chalk.cyan('Download Directory:'),
            default: getSetting('downloads', 'path', './downloads')
        },
        {
            type: 'input',
            name: 'folderTemplate',
            message: chalk.cyan('Folder Name Template:'),
            default: getSetting('downloads', 'folderTemplate', '{artist}/{album}')
        },
        {
            type: 'input',
            name: 'fileTemplate',
            message: chalk.cyan('File Name Template:'),
            default: getSetting('downloads', 'fileTemplate', '{track_number} {title}')
        },
        {
            type: 'number',
            name: 'concurrent',
            message: chalk.cyan('Concurrency Limit (1-10):'),
            default: getSetting('downloads', 'concurrent', 4),
            validate: (n) => (n > 0 && n <= 10) || 'Please enter 1-10'
        }
    ]);

    setSetting('downloads', 'path', answers.path);
    setSetting('downloads', 'folderTemplate', answers.folderTemplate);
    setSetting('downloads', 'fileTemplate', answers.fileTemplate);
    setSetting('downloads', 'concurrent', answers.concurrent);

    console.log(chalk.green('\n✅ Download settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleMetadataSettings() {
    console.log(chalk.bold.cyan('\n🏷️  Metadata & Assets:\n'));

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'embedLyrics',
            message: chalk.cyan('🎤 Embed Lyrics in file?'),
            default: getSetting('metadata', 'embedLyrics', true)
        },
        {
            type: 'confirm',
            name: 'embedCover',
            message: chalk.cyan('🖼️  Embed Cover Art in file?'),
            default: getSetting('metadata', 'embedCover', true)
        },
        {
            type: 'confirm',
            name: 'saveCoverFile',
            message: chalk.cyan('💾 Save "cover.jpg" file separately?'),
            default: getSetting('metadata', 'saveCoverFile', false)
        },
        {
            type: 'confirm',
            name: 'saveLrcFile',
            message: chalk.cyan('📝 Save ".lrc" lyrics file separately?'),
            default: getSetting('metadata', 'saveLrcFile', false)
        },
        {
            type: 'list',
            name: 'coverSize',
            message: chalk.cyan('Select Cover Art Size:'),
            default: getSetting('metadata', 'coverSize', 'max'),
            choices: [
                { name: 'Maximum (Original)', value: 'max' },
                { name: 'Large (600x600)', value: '600' },
                { name: 'Small (300x300)', value: '300' }
            ]
        }
    ]);

    setSetting('metadata', 'embedLyrics', answers.embedLyrics);
    setSetting('metadata', 'embedCover', answers.embedCover);
    setSetting('metadata', 'saveCoverFile', answers.saveCoverFile);
    setSetting('metadata', 'saveLrcFile', answers.saveLrcFile);
    setSetting('metadata', 'coverSize', answers.coverSize);

    console.log(chalk.green('\n✅ Metadata settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleDisplaySettings() {
    console.log(chalk.bold.cyan('\n🎨 Display Configuration:\n'));

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'showProgress',
            message: chalk.cyan('Show Download Progress Bars?'),
            default: getSetting('display', 'showProgress', true)
        },
        {
            type: 'confirm',
            name: 'showMetadata',
            message: chalk.cyan('Show Track Metadata before download?'),
            default: getSetting('display', 'showMetadata', true)
        },
        {
            type: 'list',
            name: 'colorScheme',
            message: chalk.cyan('Select Color Theme:'),
            default: getSetting('display', 'colorScheme', 'gradient'),
            choices: [
                { name: '🌈 Gradient (Default)', value: 'gradient' },
                { name: '🌑 Dark/Minimal', value: 'dark' },
                { name: '💡 Light', value: 'light' }
            ]
        }
    ]);

    setSetting('display', 'showProgress', answers.showProgress);
    setSetting('display', 'showMetadata', answers.showMetadata);
    setSetting('display', 'colorScheme', answers.colorScheme);

    console.log(chalk.green('\n✅ Display settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleTelegramSettings() {
    console.log(chalk.bold.cyan('\n🤖 Telegram Bot Integration:\n'));
    console.log(chalk.yellow('ℹ️  Token and ChatID must be set in Environment Variables (.env)'));
    console.log();

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'uploadFiles',
            message: chalk.cyan('⬆️  Automatically upload downloaded files to Telegram?'),
            default: getSetting('telegram', 'uploadFiles', true)
        },
        {
            type: 'confirm',
            name: 'autoDelete',
            message: chalk.cyan('🗑️  Delete local files after upload?'),
            default: getSetting('telegram', 'autoDelete', true)
        }
    ]);

    setSetting('telegram', 'uploadFiles', answers.uploadFiles);
    setSetting('telegram', 'autoDelete', answers.autoDelete);

    console.log(chalk.green('\n✅ Telegram settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleResetSettings() {
    console.log(chalk.bold.red('\n🔄 Reset to Default Settings:\n'));
    console.log(chalk.yellow('⚠️  This will revert all configuration to their original values!'));
    console.log();

    const answer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirm',
            message: chalk.cyan('Are you sure you want to reset all settings?'),
            default: false
        }
    ]);

    if (answer.confirm) {
        settingsService.reset();
        console.log(chalk.green('\n✅ All settings have been reset to defaults!'));
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }
}

async function showSettingsHelp() {
    console.log(chalk.bold.cyan('\n📖 Settings Guide (English):\n'));

    console.log(chalk.bold.yellow('--- GENERAL ---'));
    console.log(
        chalk.white('quality.default   ') +
            chalk.gray(': "ask" to prompt every time, "max" for best, "min" for 320kbps.')
    );
    console.log(
        chalk.white('embedLyrics       ') +
            chalk.gray(': Automatically embed lyrics into the music file.')
    );
    console.log(
        chalk.white('embedCover        ') +
            chalk.gray(': Automatically embed cover art into the music file.')
    );

    console.log(chalk.bold.yellow('\n--- DOWNLOADS ---'));
    console.log(
        chalk.white('path              ') +
            chalk.gray(': The directory where your music will be saved.')
    );
    console.log(
        chalk.white('concurrent        ') +
            chalk.gray(': How many songs to download at once (1-10 recommended).')
    );
    console.log(
        chalk.white('folderTemplate    ') +
            chalk.gray(': Structure of folders (e.g., "{artist}/{album}").')
    );
    console.log(
        chalk.white('fileTemplate      ') +
            chalk.gray(': How files are named (e.g., "{track_number} {title}").')
    );

    console.log(chalk.bold.yellow('\n--- METADATA ---'));
    console.log(
        chalk.white('saveCoverFile     ') +
            chalk.gray(': Save "cover.jpg" inside the album folder.')
    );
    console.log(
        chalk.white('saveLrcFile       ') + chalk.gray(': Save a separate ".lrc" file for lyrics.')
    );
    console.log(
        chalk.white('lyricsType        ') +
            chalk.gray(': "synced" (LRC), "plain" (TXT), or "both".')
    );

    console.log(chalk.bold.yellow('\n--- TELEGRAM ---'));
    console.log(
        chalk.white('uploadFiles       ') +
            chalk.gray(': Automatically send downloaded songs to your Telegram bot.')
    );
    console.log(
        chalk.white('autoDelete        ') +
            chalk.gray(': Delete the local file after a successful Telegram upload.')
    );

    console.log(chalk.cyan('\nPress any key to return to settings menu...'));
    await new Promise((resolve) => {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.once('data', () => {
            process.stdin.setRawMode(false);
            resolve(true);
        });
    });
}
