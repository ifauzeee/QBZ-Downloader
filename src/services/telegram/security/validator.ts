import { logger } from '../../../utils/logger.js';

export interface UrlValidationResult {
    valid: boolean;

    type?: string;

    id?: string;

    error?: string;
}

export interface QueryValidationResult {
    valid: boolean;

    sanitized?: string;

    error?: string;
}

export interface ValidatorConfig {
    maxQueryLength: number;

    maxUrlLength: number;

    allowedHosts: string[];

    strictMode: boolean;
}

const DEFAULT_CONFIG: ValidatorConfig = {
    maxQueryLength: 200,
    maxUrlLength: 500,
    allowedHosts: ['qobuz.com', 'play.qobuz.com', 'open.qobuz.com', 'www.qobuz.com'],
    strictMode: true
};

export class InputValidator {
    private config: ValidatorConfig;

    private readonly URL_PATTERNS = {
        album: /(?:qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?album\/|\/album\/)([a-zA-Z0-9]+)/i,
        track: /(?:qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?track\/|\/track\/)([a-zA-Z0-9]+)/i,
        playlist: /(?:qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?playlist\/|\/playlist\/)([a-zA-Z0-9]+)/i,
        artist: /(?:qobuz\.com\/(?:[a-z]{2}-[a-z]{2}\/)?(?:interpreter|artist)\/|\/(?:interpreter|artist)\/)([^/]+)\/([a-zA-Z0-9]+)/i
    };

    private readonly DANGEROUS_PATTERNS = [
        /<script/i,
        /javascript:/i,
        /data:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /&#/,
        /%3C/i,
        /%3E/i
    ];

    constructor(config: Partial<ValidatorConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    validateUrl(url: string): UrlValidationResult {
        if (!url || typeof url !== 'string') {
            return { valid: false, error: 'URL is required' };
        }

        url = url.trim();
        if (url.length > this.config.maxUrlLength) {
            return { valid: false, error: 'URL is too long' };
        }

        for (const pattern of this.DANGEROUS_PATTERNS) {
            if (pattern.test(url)) {
                logger.warn(
                    `Validator: Dangerous pattern detected in URL: ${url.substring(0, 50)}`
                );
                return { valid: false, error: 'Invalid URL format' };
            }
        }

        if (!url.includes('qobuz.com')) {
            return { valid: false, error: 'Not a Qobuz URL' };
        }

        try {
            const parsedUrl = new URL(url);

            if (this.config.strictMode) {
                const host = parsedUrl.hostname.toLowerCase();
                if (!this.config.allowedHosts.includes(host)) {
                    return { valid: false, error: 'Invalid Qobuz domain' };
                }
            }

            if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
                return { valid: false, error: 'Invalid protocol' };
            }
        } catch {}

        for (const [type, pattern] of Object.entries(this.URL_PATTERNS)) {
            const match = url.match(pattern);
            if (match) {
                const id = type === 'artist' ? match[2] : match[1];

                if (!this.isValidId(id)) {
                    return { valid: false, error: 'Invalid ID format' };
                }

                return { valid: true, type, id };
            }
        }

        return { valid: false, error: 'Could not parse Qobuz URL' };
    }

    validateQuery(query: string): QueryValidationResult {
        if (!query || typeof query !== 'string') {
            return { valid: false, error: 'Query is required' };
        }

        query = query.trim();

        if (query.length === 0) {
            return { valid: false, error: 'Query cannot be empty' };
        }
        if (query.length > this.config.maxQueryLength) {
            return {
                valid: false,
                error: `Query too long (max ${this.config.maxQueryLength} chars)`
            };
        }
        if (query.length < 2) {
            return { valid: false, error: 'Query too short (min 2 chars)' };
        }

        for (const pattern of this.DANGEROUS_PATTERNS) {
            if (pattern.test(query)) {
                logger.warn(`Validator: Dangerous pattern in query: ${query.substring(0, 30)}`);
                return { valid: false, error: 'Invalid query format' };
            }
        }

        const sanitized = query
            .replace(/[<>'"\\]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        if (sanitized.length === 0) {
            return { valid: false, error: 'Query contains only invalid characters' };
        }

        return { valid: true, sanitized };
    }

    validateQuality(quality: number | string): boolean {
        const validQualities = [5, 6, 7, 27];

        if (typeof quality === 'string') {
            if (quality === 'ask' || quality === 'min' || quality === 'max') {
                return true;
            }
            quality = parseInt(quality, 10);
        }

        return !isNaN(quality) && validQualities.includes(quality);
    }

    isValidId(id: string | number): boolean {
        if (id === undefined || id === null) return false;

        const strId = String(id);

        if (!/^[a-zA-Z0-9]+$/.test(strId)) return false;
        if (strId.length < 1 || strId.length > 50) return false;

        return true;
    }

    sanitizeForDisplay(str: string): string {
        if (!str || typeof str !== 'string') return '';

        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    isValidUserId(userId: string | number): boolean {
        if (userId === undefined || userId === null) return false;

        const strId = String(userId);

        if (!/^\d+$/.test(strId)) return false;
        if (strId.length < 1 || strId.length > 20) return false;

        return true;
    }
}

export const inputValidator = new InputValidator();
