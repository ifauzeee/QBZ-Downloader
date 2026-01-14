import chalk from 'chalk';
import { CONFIG } from '../config.js';
import { settingsService } from '../services/settings.js';

export function validateEnvironment(_exitOnError = true) {
    const warnings: string[] = [];

    if (settingsService.isConfigured()) {
        return { valid: true, warnings };
    }

    const missing: string[] = [];
    const creds = CONFIG.credentials;

    if (!creds.appId) missing.push('QOBUZ_APP_ID');
    if (!creds.appSecret) missing.push('QOBUZ_APP_SECRET');
    if (!creds.token) missing.push('QOBUZ_USER_AUTH_TOKEN');

    if (missing.length > 0) {
        return { valid: false, warnings, missing };
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
            appId: !!CONFIG.credentials.appId,
            appSecret: !!CONFIG.credentials.appSecret,
            token: !!CONFIG.credentials.token,
            userId: !!CONFIG.credentials.userId
        },
        paths: {
            downloadPath: CONFIG.download.outputDir,
            folderTemplate: CONFIG.download.folderStructure,
            fileNaming: CONFIG.download.fileNaming
        },
        telegram: {
            botToken: !!CONFIG.telegram.token,
            chatId: !!CONFIG.telegram.chatId
        }
    };
}
