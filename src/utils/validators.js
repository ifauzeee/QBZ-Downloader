import { ValidationError } from './errors.js';

const QOBUZ_URL_PATTERNS = {
    track: /qobuz\.com\/[a-z-]+\/track\/(\d+)/i,
    album: /qobuz\.com\/[a-z-]+\/album\/[^\/]+\/([a-zA-Z0-9]+)/i,
    artist: /qobuz\.com\/[a-z-]+\/artist\/(\d+)/i,
    playlist: /qobuz\.com\/[a-z-]+\/playlist\/(\d+)/i,
    label: /qobuz\.com\/[a-z-]+\/label\/[^\/]+\/(\d+)/i
};

const VALID_QUALITIES = [5, 6, 7, 27];

export function validateQobuzUrl(url) {
    if (!url || typeof url !== 'string') {
        throw new ValidationError('URL is required', 'url');
    }

    const trimmedUrl = url.trim();

    if (/^\d+$/.test(trimmedUrl)) {
        return { valid: true, type: 'album', id: trimmedUrl };
    }

    for (const [type, pattern] of Object.entries(QOBUZ_URL_PATTERNS)) {
        const match = trimmedUrl.match(pattern);
        if (match) {
            return { valid: true, type, id: match[1] };
        }
    }

    throw new ValidationError(
        'Invalid Qobuz URL. Supported formats:\n' +
        '  • https://www.qobuz.com/us-en/album/...\n' +
        '  • https://www.qobuz.com/us-en/track/...\n' +
        '  • Album ID (numeric)',
        'url'
    );
}

export function validateQuality(quality) {
    const qualityId = parseInt(quality, 10);

    if (isNaN(qualityId)) {
        throw new ValidationError(
            `Invalid quality format: "${quality}". Must be a number.`,
            'quality'
        );
    }

    if (!VALID_QUALITIES.includes(qualityId)) {
        throw new ValidationError(
            `Invalid quality ID: ${qualityId}. Valid options:\n` +
            '  • 5  - MP3 320\n' +
            '  • 6  - FLAC 16-bit/44.1kHz (CD)\n' +
            '  • 7  - FLAC 24-bit/96kHz (Hi-Res)\n' +
            '  • 27 - FLAC 24-bit/192kHz (Hi-Res Max)',
            'quality'
        );
    }

    return qualityId;
}

export function validateSearchType(type) {
    const validTypes = ['albums', 'tracks', 'artists'];

    if (!validTypes.includes(type.toLowerCase())) {
        throw new ValidationError(
            `Invalid search type: "${type}". Valid options: ${validTypes.join(', ')}`,
            'type'
        );
    }

    return type.toLowerCase();
}

export function validateLimit(limit) {
    const limitNum = parseInt(limit, 10);

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        throw new ValidationError(
            'Limit must be a number between 1 and 100',
            'limit'
        );
    }

    return limitNum;
}

export function isValidUrl(url) {
    try {
        validateQobuzUrl(url);
        return true;
    } catch {
        return false;
    }
}
