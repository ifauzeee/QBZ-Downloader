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

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
}