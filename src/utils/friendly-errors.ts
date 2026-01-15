/**
 * User-Friendly Error Messages
 * Translates technical errors into helpful messages for users
 */

interface ErrorInfo {
    message: string;
    suggestion: string;
    emoji: string;
}

const ERROR_PATTERNS: Record<string, ErrorInfo> = {
    ENOTFOUND: {
        message: 'Tidak ada koneksi internet',
        suggestion: 'Periksa koneksi internet Anda dan coba lagi.',
        emoji: '🌐'
    },
    ECONNREFUSED: {
        message: 'Server tidak dapat dijangkau',
        suggestion: 'Server mungkin sedang down. Coba lagi nanti.',
        emoji: '🔌'
    },
    ETIMEDOUT: {
        message: 'Koneksi timeout',
        suggestion: 'Koneksi terlalu lambat. Periksa internet Anda.',
        emoji: '⏱️'
    },
    ECONNRESET: {
        message: 'Koneksi terputus',
        suggestion: 'Coba ulangi permintaan Anda.',
        emoji: '🔄'
    },

    '401': {
        message: 'Autentikasi gagal',
        suggestion: 'Token Anda mungkin expired. Jalankan "qbz-dl setup" untuk memperbarui credentials.',
        emoji: '🔐'
    },
    'invalid_credentials': {
        message: 'Credentials tidak valid',
        suggestion: 'Periksa App ID, Secret, dan Token Anda di Settings.',
        emoji: '🔑'
    },

    '403': {
        message: 'Akses ditolak',
        suggestion: 'Fitur ini mungkin memerlukan langganan Qobuz premium.',
        emoji: '⚠️'
    },
    'subscription_required': {
        message: 'Langganan premium diperlukan',
        suggestion: 'Kualitas Hi-Res memerlukan langganan Qobuz Studio atau Studio Premier.',
        emoji: '💎'
    },

    ENOSPC: {
        message: 'Disk penuh',
        suggestion: 'Hapus beberapa file untuk membuat ruang.',
        emoji: '💾'
    },
    EACCES: {
        message: 'Tidak punya izin',
        suggestion: 'Periksa izin folder download atau jalankan sebagai administrator.',
        emoji: '🚫'
    },
    ENOENT: {
        message: 'File atau folder tidak ditemukan',
        suggestion: 'Pastikan path yang Anda masukkan benar.',
        emoji: '📁'
    },

    '404': {
        message: 'Konten tidak ditemukan',
        suggestion: 'Track, album, atau playlist mungkin tidak tersedia lagi.',
        emoji: '🔍'
    },
    '429': {
        message: 'Terlalu banyak permintaan',
        suggestion: 'Tunggu beberapa saat sebelum mencoba lagi.',
        emoji: '⏳'
    },
    '500': {
        message: 'Server Qobuz bermasalah',
        suggestion: 'Ini masalah dari Qobuz. Coba lagi nanti.',
        emoji: '🔧'
    },

    'track_restricted': {
        message: 'Track tidak tersedia di wilayah Anda',
        suggestion: 'Beberapa konten dibatasi berdasarkan lokasi geografis.',
        emoji: '🌍'
    },
    'no_streamable': {
        message: 'Track tidak dapat di-stream',
        suggestion: 'Track ini mungkin tidak tersedia untuk download.',
        emoji: '🚫'
    }
};

/**
 * Humanizes an error into a user-friendly message
 */
export function humanizeError(error: Error | string | unknown): ErrorInfo {
    const errorString = error instanceof Error ? error.message : String(error);

    for (const [pattern, info] of Object.entries(ERROR_PATTERNS)) {
        if (
            errorString.includes(pattern) ||
            errorString.toLowerCase().includes(pattern.toLowerCase())
        ) {
            return info;
        }
    }

    return {
        message: 'Terjadi kesalahan',
        suggestion: `Detail: ${errorString.slice(0, 100)}`,
        emoji: '❌'
    };
}

/**
 * Formats error for CLI display
 */
export function formatErrorForCLI(error: Error | string | unknown): string {
    const info = humanizeError(error);
    return `${info.emoji} ${info.message}\n   💡 ${info.suggestion}`;
}

/**
 * Formats error for API response
 */
export function formatErrorForAPI(
    error: Error | string | unknown
): { error: string; suggestion: string; code: string } {
    const info = humanizeError(error);
    const errorString = error instanceof Error ? error.message : String(error);

    return {
        error: info.message,
        suggestion: info.suggestion,
        code: extractErrorCode(errorString)
    };
}

/**
 * Extracts error code from error message
 */
function extractErrorCode(errorString: string): string {
    const httpMatch = errorString.match(/\b(4\d{2}|5\d{2})\b/);
    if (httpMatch) return httpMatch[1];

    const nodeMatch = errorString.match(/\b(E[A-Z]+)\b/);
    if (nodeMatch) return nodeMatch[1];

    return 'UNKNOWN';
}

/**
 * Common error checkers
 */
export const errorChecks = {
    isNetworkError: (error: unknown): boolean => {
        const msg = String(error);
        return ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET'].some((code) =>
            msg.includes(code)
        );
    },

    isAuthError: (error: unknown): boolean => {
        const msg = String(error);
        return msg.includes('401') || msg.includes('invalid_credentials');
    },

    isSubscriptionError: (error: unknown): boolean => {
        const msg = String(error);
        return msg.includes('403') || msg.includes('subscription');
    },

    isRateLimitError: (error: unknown): boolean => {
        const msg = String(error);
        return msg.includes('429') || msg.includes('rate limit');
    }
};

export default {
    humanizeError,
    formatErrorForCLI,
    formatErrorForAPI,
    errorChecks
};
