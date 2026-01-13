import chalk from 'chalk';
import { ConfigurationError } from './errors.js';

const REQUIRED_VARS = ['QOBUZ_APP_ID', 'QOBUZ_APP_SECRET', 'QOBUZ_USER_AUTH_TOKEN'];

const _OPTIONAL_VARS = [
    'QOBUZ_USER_ID',
    'SPOTIFY_CLIENT_ID',
    'SPOTIFY_CLIENT_SECRET',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
];

export function validateEnvironment(exitOnError = true) {
    const missing: string[] = [];
    const warnings: string[] = [];

    for (const varName of REQUIRED_VARS) {
        if (varName === 'QOBUZ_USER_AUTH_TOKEN') {
            if (!process.env.QOBUZ_USER_AUTH_TOKEN && !process.env.QOBUZ_TOKEN) {
                missing.push('QOBUZ_USER_AUTH_TOKEN (or QOBUZ_TOKEN)');
            }
        } else if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
        warnings.push('Spotify credentials not set - enhanced metadata will be limited');
    }

    if (missing.length > 0) {
        const error = new ConfigurationError(
            `Missing required environment variables:\n${missing.map((v) => `  • ${v}`).join('\n')}\n\n` +
                'Please copy .env.example to .env and fill in your credentials.',
            missing
        );

        if (exitOnError) {
            console.error(chalk.red('\n❌ Configuration Error\n'));
            console.error(chalk.yellow(error.message));
            process.exit(1);
        }

        throw error;
    }

    return { valid: true, warnings };
}

export function displayEnvWarnings(warnings: string[]) {
    if (warnings && warnings.length > 0) {
        for (const warning of warnings) {
            console.log(chalk.yellow(`⚠️  ${warning}`));
        }
    }
}

export function getEnvSummary() {
    return {
        qobuz: {
            appId: !!process.env.QOBUZ_APP_ID,
            appSecret: !!process.env.QOBUZ_APP_SECRET,
            token: !!process.env.QOBUZ_USER_AUTH_TOKEN,
            userId: !!process.env.QOBUZ_USER_ID
        },
        spotify: {
            clientId: !!process.env.SPOTIFY_CLIENT_ID,
            clientSecret: !!process.env.SPOTIFY_CLIENT_SECRET
        },
        paths: {
            downloadPath: process.env.DOWNLOAD_PATH || './downloads',
            folderTemplate: process.env.FOLDER_TEMPLATE || '{artist}/{album}',
            fileTemplate: process.env.FILE_TEMPLATE || '{trackNumber}. {title}'
        },
        telegram: {
            botToken: !!process.env.TELEGRAM_BOT_TOKEN,
            chatId: !!process.env.TELEGRAM_CHAT_ID
        }
    };
}
