import inquirer from 'inquirer';
import chalk from 'chalk';
import * as display from '../utils/display.js';
import { settingsService } from '../services/settings.js';

export async function handleSettings() {
    let inSettings = true;

    while (inSettings) {
        console.clear();
        display.displayBanner();

        const currentQuality = settingsService.get('defaultQuality');
        let qualityText = '';

        switch (currentQuality) {
            case 'max':
                qualityText = chalk.green('Maximum Available (Hi-Res)');
                break;
            case 'min':
                qualityText = chalk.yellow('Minimum Available (MP3/CD)');
                break;
            case 'ask':
                qualityText = chalk.hex('#FFA500')('Always Ask');
                break;
            default:
                qualityText = String(currentQuality);
        }

        const embedLyrics = settingsService.get('embedLyrics')
            ? chalk.green('Yes')
            : chalk.red('No');
        const embedCover = settingsService.get('embedCover') ? chalk.green('Yes') : chalk.red('No');

        console.log(chalk.bold.cyan('\n⚙️  Settings:\n'));
        console.log(chalk.white(`  1) 🎚️ Default Quality: [${qualityText}]`));
        console.log(chalk.white('  2) 🏷️ Metadata & Tags'));
        console.log(chalk.gray(`     └─ Lyrics: ${embedLyrics} | Cover: ${embedCover}`));
        console.log(chalk.white('  3) 🔙 Back to Main Menu'));
        console.log();

        const answer = await inquirer.prompt([
            {
                type: 'input',
                name: 'action',
                message: chalk.cyan('Select option (1-3):'),
                validate: (input) => {
                    const num = parseInt(input);
                    if (num >= 1 && num <= 3) return true;
                    return 'Please enter 1, 2, or 3';
                }
            }
        ]);

        const choice = parseInt(answer.action);

        if (choice === 1) {
            await handleQualitySettings();
        } else if (choice === 2) {
            await handleMetadataSettings();
        } else if (choice === 3) {
            inSettings = false;
        }
    }
}

async function handleQualitySettings() {
    console.log(chalk.bold.cyan('\n🎚️ Select Default Download Quality:\n'));

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'quality',
            message: chalk.cyan('Choose default quality preference:'),
            choices: [
                { name: '🔥 Always Maximum (Prioritize Hi-Res 24-bit)', value: 'max' },
                { name: '🎵 Always Minimum (MP3/CD - Save Space)', value: 'min' },
                { name: '❓ Always Ask (I want to choose every time)', value: 'ask' }
            ]
        }
    ]);

    settingsService.set('defaultQuality', answer.quality);
    console.log(chalk.green('\n✅ Settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function handleMetadataSettings() {
    console.log(chalk.bold.cyan('\n🏷️  Metadata & Tagging Settings:\n'));

    const answers = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'embedLyrics',
            message: chalk.cyan('🎤 Embed Lyrics?'),
            default: settingsService.get('embedLyrics')
        },
        {
            type: 'confirm',
            name: 'embedCover',
            message: chalk.cyan('🖼️ Embed Cover Art?'),
            default: settingsService.get('embedCover')
        }
    ]);

    settingsService.set('embedLyrics', answers.embedLyrics);
    settingsService.set('embedCover', answers.embedCover);

    console.log(chalk.green('\n✅ Settings saved!'));
    await new Promise((resolve) => setTimeout(resolve, 1000));
}
