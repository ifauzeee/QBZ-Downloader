export class QobuzError extends Error {
    constructor(message, code = 'UNKNOWN_ERROR') {
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
    constructor(message, statusCode = null) {
        super(message, 'API_ERROR');
        this.name = 'APIError';
        this.statusCode = statusCode;
    }
}

export class DownloadError extends QobuzError {
    constructor(message, trackId = null) {
        super(message, 'DOWNLOAD_ERROR');
        this.name = 'DownloadError';
        this.trackId = trackId;
    }
}

export class ValidationError extends QobuzError {
    constructor(message, field = null) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
        this.field = field;
    }
}

export class ConfigurationError extends QobuzError {
    constructor(message, missingVars = []) {
        super(message, 'CONFIG_ERROR');
        this.name = 'ConfigurationError';
        this.missingVars = missingVars;
    }
}

export function handleError(error, display) {
    if (error instanceof ValidationError) {
        display.displayError(`Validation Error: ${error.message}`);
    } else if (error instanceof AuthenticationError) {
        display.displayError(
            `Authentication Error: ${error.message}\n\nPlease check your .env file and ensure QOBUZ_APP_ID, QOBUZ_APP_SECRET, and QOBUZ_USER_AUTH_TOKEN are set correctly.`
        );
    } else if (error instanceof APIError) {
        display.displayError(
            `API Error: ${error.message}${error.statusCode ? ` (Status: ${error.statusCode})` : ''}`
        );
    } else if (error instanceof DownloadError) {
        display.displayError(
            `Download Error: ${error.message}${error.trackId ? ` (Track ID: ${error.trackId})` : ''}`
        );
    } else if (error instanceof ConfigurationError) {
        display.displayError(
            `Configuration Error: ${error.message}\n\nMissing: ${error.missingVars.join(', ')}`
        );
    } else {
        display.displayError(error.message || 'An unexpected error occurred');
    }
}
