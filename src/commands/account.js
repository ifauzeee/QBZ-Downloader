import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import QobuzAPI from '../api/qobuz.js';
import * as display from '../utils/display.js';

const api = new QobuzAPI();

export function registerAccountCommand(program) {
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
                    display.displayError(result.error);
                    process.exit(1);
                }

                spinner.succeed(chalk.green('Account info retrieved!'));
                display.displayAccountInfo(result.data);
                display.displayQualityOptions();
            } catch (error) {
                spinner.fail(chalk.red('An error occurred'));
                display.displayError(error.message);
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
            display.displayError(result.error);
            return;
        }

        spinner.succeed(chalk.green('Account info retrieved!'));
        display.displayAccountInfo(result.data);
        display.displayQualityOptions();
    } catch (error) {
        spinner.fail(chalk.red('An error occurred'));
        display.displayError(error.message);
    }

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: chalk.gray('Press Enter to continue...')
        }
    ]);
}
