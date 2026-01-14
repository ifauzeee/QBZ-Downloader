import fs from 'fs';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { displayBanner, displaySuccess } from '../utils/display.js';
import { Command } from 'commander';
import { settingsService } from '../services/settings.js';

export function registerSetupCommand(program: Command) {
    program
        .command('setup')
        .description('Configure essential credentials and generate .env')
        .action(async () => {
            displayBanner();
            await runSetup();
        });
}

export async function runSetup() {
    console.log(chalk.cyan('🛠️  Qobuz-DL Configuration Wizard\n'));
    console.log(chalk.gray('This wizard will help you initialize the application.\n'));

    try {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'QOBUZ_APP_ID',
                message: 'Qobuz App ID:',
                default: settingsService.get('QOBUZ_APP_ID') || process.env.QOBUZ_APP_ID,
                validate: (input) => input.length > 0 || 'Required'
            },
            {
                type: 'password',
                name: 'QOBUZ_APP_SECRET',
                message: 'Qobuz App Secret:',
                default: settingsService.get('QOBUZ_APP_SECRET') || process.env.QOBUZ_APP_SECRET,
                validate: (input) => input.length > 0 || 'Required'
            },
            {
                type: 'password',
                name: 'QOBUZ_USER_AUTH_TOKEN',
                message: 'User Auth Token:',
                default:
                    settingsService.get('QOBUZ_USER_AUTH_TOKEN') ||
                    process.env.QOBUZ_USER_AUTH_TOKEN,
                validate: (input) => input.length > 0 || 'Required'
            },
            {
                type: 'input',
                name: 'QOBUZ_USER_ID',
                message: 'User ID:',
                default: settingsService.get('QOBUZ_USER_ID') || process.env.QOBUZ_USER_ID,
                validate: (input) => input.length > 0 || 'Required'
            },
            {
                type: 'input',
                name: 'TELEGRAM_BOT_TOKEN',
                message: 'Telegram Bot Token (Optional):',
                default: settingsService.get('TELEGRAM_BOT_TOKEN') || ''
            },
            {
                type: 'input',
                name: 'TELEGRAM_CHAT_ID',
                message: 'Telegram Chat ID (Optional):',
                default: settingsService.get('TELEGRAM_CHAT_ID') || '',
                when: (ans) => !!ans.TELEGRAM_BOT_TOKEN
            },
            {
                type: 'number',
                name: 'DASHBOARD_PORT',
                message: 'Dashboard Port:',
                default: 3000
            },
            {
                type: 'input',
                name: 'DASHBOARD_PASSWORD',
                message: 'Dashboard Password (Optional):',
                default: ''
            }
        ]);

        const envContent = `# ==============================================================================
# QBZ-DOWNLOADER - REQUIRED CONFIGURATION
# ==============================================================================
# Fill these in to initialize the application. 
# Once configured, you can use the Web Dashboard to manage other settings.
# ==============================================================================

# QOBUZ CREDENTIALS (REQUIRED)
QOBUZ_APP_ID=${answers.QOBUZ_APP_ID}
QOBUZ_APP_SECRET=${answers.QOBUZ_APP_SECRET}
QOBUZ_USER_AUTH_TOKEN=${answers.QOBUZ_USER_AUTH_TOKEN}
QOBUZ_USER_ID=${answers.QOBUZ_USER_ID}

# TELEGRAM BOT (OPTIONAL)
TELEGRAM_BOT_TOKEN=${answers.TELEGRAM_BOT_TOKEN || ''}
TELEGRAM_CHAT_ID=${answers.TELEGRAM_CHAT_ID || ''}

# WEB DASHBOARD (OPTIONAL)
DASHBOARD_PORT=${answers.DASHBOARD_PORT}
DASHBOARD_PASSWORD=${answers.DASHBOARD_PASSWORD}

# MISC
NODE_ENV=production
`;

        fs.writeFileSync('.env', envContent);

        settingsService.set('QOBUZ_APP_ID', answers.QOBUZ_APP_ID);
        settingsService.set('QOBUZ_APP_SECRET', answers.QOBUZ_APP_SECRET);
        settingsService.set('QOBUZ_USER_AUTH_TOKEN', answers.QOBUZ_USER_AUTH_TOKEN);
        settingsService.set('QOBUZ_USER_ID', answers.QOBUZ_USER_ID);
        settingsService.set('TELEGRAM_BOT_TOKEN', answers.TELEGRAM_BOT_TOKEN || '');
        settingsService.set('TELEGRAM_CHAT_ID', answers.TELEGRAM_CHAT_ID || '');
        settingsService.set('DASHBOARD_PORT', answers.DASHBOARD_PORT);
        settingsService.set('DASHBOARD_PASSWORD', answers.DASHBOARD_PASSWORD);

        displaySuccess('Configuration saved and .env file generated!');

        console.log(chalk.bold.green('\n🚀 Setup Complete!'));
        console.log(
            chalk.white('1. Your ') + chalk.cyan('.env') + chalk.white(' file has been created.')
        );
        console.log(chalk.white('2. Essential credentials are saved to the database.'));
        console.log(
            chalk.white('3. To manage quality, naming, and other settings, use the ') +
                chalk.bold.yellow('Web Dashboard') +
                chalk.white('.')
        );
        console.log(chalk.gray('\nRun "qbz-dl dashboard" to start the interface.\n'));
    } catch (error: unknown) {
        console.error(chalk.red('Setup failed:'), (error as Error).message);
    }
}
