import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { displayBanner, displaySuccess } from '../utils/display.js';
import { Command } from 'commander';

export function registerSetupCommand(program: Command) {
    program
        .command('setup')
        .description('Configure Qobuz-DL credentials')
        .action(async () => {
            displayBanner();
            await runSetup();
        });
}

export async function runSetup() {
    console.log(chalk.cyan('🛠️  Qobuz-DL Configuration Wizard\n'));
    console.log(chalk.gray('This wizard will help you create the .env configuration file.\n'));

    try {
        const currentConfig = loadCurrentConfig();

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'appId',
                message: 'Enter Qobuz App ID:',
                default: currentConfig.QOBUZ_APP_ID,
                validate: (input) => input.length > 0 || 'App ID is required'
            },
            {
                type: 'password',
                name: 'appSecret',
                message: 'Enter Qobuz App Secret:',
                default: currentConfig.QOBUZ_APP_SECRET,
                validate: (input) => input.length > 0 || 'App Secret is required'
            },
            {
                type: 'password',
                name: 'token',
                message: 'Enter User Auth Token:',
                default: currentConfig.QOBUZ_USER_AUTH_TOKEN,
                validate: (input) => input.length > 0 || 'User Auth Token is required'
            },
            {
                type: 'input',
                name: 'downloadPath',
                message: 'Download Directory:',
                default: currentConfig.DOWNLOAD_PATH || './downloads'
            }
        ]);

        const envContent = [
            `QOBUZ_APP_ID=${answers.appId}`,
            `QOBUZ_APP_SECRET=${answers.appSecret}`,
            `QOBUZ_USER_AUTH_TOKEN=${answers.token}`,
            `DOWNLOAD_PATH=${answers.downloadPath}`,
            '',
            '# Optional: Spotify Credentials (for enhanced metadata)',
            `SPOTIFY_CLIENT_ID=${currentConfig.SPOTIFY_CLIENT_ID || ''}`,
            `SPOTIFY_CLIENT_SECRET=${currentConfig.SPOTIFY_CLIENT_SECRET || ''}`
        ].join('\n');

        const envPath = path.resolve(process.cwd(), '.env');
        fs.writeFileSync(envPath, envContent, 'utf8');

        displaySuccess(`Configuration saved to ${chalk.bold('.env')} successfully!`);
        console.log(
            chalk.yellow('\nTip: You might need to restart the CLI for changes to take effect.\n')
        );
    } catch (error: unknown) {
        console.error(chalk.red('Setup failed:'), (error as Error).message);
    }
}

function loadCurrentConfig(): Record<string, string> {
    const config: Record<string, string> = {};
    const envPath = path.resolve(process.cwd(), '.env');

    if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach((line) => {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
                config[key.trim()] = valueParts.join('=').trim();
            }
        });
    }
    return config;
}
