export class QobuzError extends Error {
    code: string;
    constructor(message: string, code = 'UNKNOWN_ERROR') {
        super(message);
        this.name = 'QobuzError';
        this.code = code;
    }
}

export class AuthenticationError extends QobuzError {
    constructor(message = 'Authentication failed. Please check your credentials.') {
        super(message, 'AUTH_ERROR');
        this.name = 'AuthenticationError';
    }
}

export class APIError extends QobuzError {
    statusCode: number | null;
    constructor(message: string, statusCode: number | null = null) {
        super(message, 'API_ERROR');
        this.name = 'APIError';
        this.statusCode = statusCode;
    }
}

export class DownloadError extends QobuzError {
    trackId: string | number | null;
    constructor(message: string, trackId: string | number | null = null) {
        super(message, 'DOWNLOAD_ERROR');
        this.name = 'DownloadError';
        this.trackId = trackId;
    }
}

export class ValidationError extends QobuzError {
    field: string | null;
    constructor(message: string, field: string | null = null) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.field = field;
    }
}

export class ConfigurationError extends QobuzError {
    missingVars: string[];
    constructor(message: string, missingVars: string[] = []) {
        super(message, 'CONFIG_ERROR');
        this.name = 'ConfigurationError';
        this.missingVars = missingVars;
    }
}

import { humanizeError } from './friendly-errors.js';
import { logger } from './logger.js';

export function handleError(error: Error | QobuzError, display: { displayError: (msg: string) => void }) {
    const friendlyError = humanizeError(error);

    if (error instanceof ValidationError) {
        display.displayError(`${friendlyError.emoji} Validation Error: ${error.message}`);
        logger.info(`💡 ${friendlyError.suggestion}`, 'HELP');
    } else if (error instanceof AuthenticationError) {
        display.displayError(`🔐 Authentication Error: ${error.message}`);
        logger.info(
            '💡 Periksa QOBUZ_APP_ID, QOBUZ_APP_SECRET, dan QOBUZ_USER_AUTH_TOKEN di Dashboard Settings.',
            'HELP'
        );
    } else if (error instanceof APIError) {
        display.displayError(
            `${friendlyError.emoji} ${friendlyError.message}${error.statusCode ? ` (Status: ${error.statusCode})` : ''}`
        );
        logger.info(`💡 ${friendlyError.suggestion}`, 'HELP');
    } else if (error instanceof DownloadError) {
        display.displayError(
            `📥 Download Error: ${error.message}${error.trackId ? ` (Track ID: ${error.trackId})` : ''}`
        );
        logger.info(`💡 ${friendlyError.suggestion}`, 'HELP');
    } else if (error instanceof ConfigurationError) {
        display.displayError(`⚙️ Configuration Error: ${error.message}`);
        if (error.missingVars.length > 0) {
            logger.error(`Missing: ${error.missingVars.join(', ')}`, 'CONFIG');
        }
        logger.info('💡 Lengkapi variabel yang hilang di Dashboard Settings.', 'HELP');
    } else {
        display.displayError(`${friendlyError.emoji} ${friendlyError.message}`);
        logger.info(`💡 ${friendlyError.suggestion}`, 'HELP');
    }
}

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}
