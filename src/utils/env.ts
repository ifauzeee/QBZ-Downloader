import { CONFIG } from '../config.js';
import { logger } from './logger.js';

export function validateEnvironment(_exitOnError = true) {
    const warnings: string[] = [];

    const missing: string[] = [];
    const creds = CONFIG.credentials;

    if (!creds.appId) missing.push('QOBUZ_APP_ID');
    if (!creds.appSecret) missing.push('QOBUZ_APP_SECRET');
    if (!creds.token) missing.push('QOBUZ_USER_AUTH_TOKEN');
    if (!creds.userId) missing.push('QOBUZ_USER_ID');

    if (missing.length > 0) {
        return { valid: false, warnings, missing };
    }

    return { valid: true, warnings };
}

export function displayEnvWarnings(warnings: string[]) {
    if (warnings && warnings.length > 0) {
        for (const warning of warnings) {
            logger.warn(warning, 'ENV');
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
        dashboard: {
            port: CONFIG.dashboard.port,
            password: !!CONFIG.dashboard.password
        }
    };
}
