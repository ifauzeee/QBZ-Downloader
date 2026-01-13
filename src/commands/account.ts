import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import * as display from '../utils/display.js';
import { Command } from 'commander';

const api = new QobuzAPI();

export function registerAccountCommand(program: Command) {
    program
        .command('account')
        .alias('acc')
        .description('Display account information')
        .action(async () => {
            display.displayBanner();

            const spinner = ora({
                text: display.spinnerMessage('Fetching account information...'),
                spinner: 'dots12'
            }).start();

            try {
                const result = await api.getUserInfo();

                if (!result.success) {
                    spinner.fail(chalk.red('Failed to get account info'));
                    display.displayError(result.error || 'Unknown error');
                    process.exit(1);
                }

                spinner.succeed(chalk.green('Account info retrieved!'));
                display.displayAccountInfo(result.data!);
                display.displayQualityOptions();
            } catch (error: unknown) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError((error as Error).message);
                process.exit(1);
            }
        });
}

export async function handleAccount() {
    const spinner = ora({
        text: display.spinnerMessage('Fetching account information...'),
        spinner: 'dots12'
    }).start();

    try {
        const result = await api.getUserInfo();

        if (!result.success) {
            spinner.fail(chalk.red('Failed to get account info'));
            display.displayError(result.error || 'Unknown error');
            return;
        }

        spinner.succeed(chalk.green('Account info retrieved!'));
        display.displayAccountInfo(result.data!);
        display.displayQualityOptions();
        display.displayQualityOptions();
    } catch (error: unknown) {
        spinner.fail(chalk.red('An error occurred'));
        display.displayError((error as Error).message);
    }

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: chalk.gray('Press Enter to continue...')
        }
    ]);
}
