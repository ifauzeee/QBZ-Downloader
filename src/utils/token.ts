import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

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

export async function refreshUserToken(): Promise<string | null> {
    console.log(chalk.red('\n⚠️  Qobuz User Token expired or invalid!'));

    const { update } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'update',
            message: 'Would you like to update your token now?',
            default: true
        }
    ]);

    if (!update) {
        return null;
    }

    const { newToken } = await inquirer.prompt([
        {
            type: 'password',
            name: 'newToken',
            message: 'Enter new Qobuz User Auth Token:',
            validate: (input) => input.length > 0 || 'Token is required'
        }
    ]);

    try {
        const currentConfig = loadCurrentConfig();
        currentConfig.QOBUZ_USER_AUTH_TOKEN = newToken;

        const envContent = Object.entries(currentConfig)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const envPath = path.resolve(process.cwd(), '.env');
        fs.writeFileSync(envPath, envContent, 'utf8');

        console.log(chalk.green('✅ Token updated in .env file.'));

        process.env.QOBUZ_USER_AUTH_TOKEN = newToken;

        return newToken;
    } catch (error: unknown) {
        console.error(chalk.red(`Failed to save token: ${(error as Error).message}`));
        return null;
    }
}
