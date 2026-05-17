export type SupportedLocale = 'id' | 'en';

interface ErrorInfo {
    message: string;
    suggestion: string;
    emoji: string;
}

interface LocalizedErrorInfo {
    message: Record<SupportedLocale, string>;
    suggestion: Record<SupportedLocale, string>;
    emoji: string;
}

const ERROR_PATTERNS: Record<string, LocalizedErrorInfo> = {
    ENOTFOUND: {
        message: {
            id: 'Tidak ada koneksi internet',
            en: 'No internet connection'
        },
        suggestion: {
            id: 'Periksa koneksi internet Anda dan coba lagi.',
            en: 'Check your internet connection and try again.'
        },
        emoji: '\u{1F310}'
    },
    ECONNREFUSED: {
        message: {
            id: 'Server tidak dapat dijangkau',
            en: 'Server unreachable'
        },
        suggestion: {
            id: 'Server mungkin sedang down. Coba lagi nanti.',
            en: 'The server may be down. Try again later.'
        },
        emoji: '\u{1F50C}'
    },
    ETIMEDOUT: {
        message: {
            id: 'Koneksi timeout',
            en: 'Connection timed out'
        },
        suggestion: {
            id: 'Koneksi terlalu lambat. Periksa internet Anda.',
            en: 'Connection too slow. Check your internet.'
        },
        emoji: '\u{23F1}\u{FE0F}'
    },
    ECONNRESET: {
        message: {
            id: 'Koneksi terputus',
            en: 'Connection interrupted'
        },
        suggestion: {
            id: 'Coba ulangi permintaan Anda.',
            en: 'Try your request again.'
        },
        emoji: '\u{1F504}'
    },

    '401': {
        message: {
            id: 'Autentikasi gagal',
            en: 'Authentication failed'
        },
        suggestion: {
            id: 'Token Anda mungkin expired. Perbarui QOBUZ_USER_AUTH_TOKEN dari halaman Settings di dashboard.',
            en: 'Your token may be expired. Update QOBUZ_USER_AUTH_TOKEN from the dashboard Settings page.'
        },
        emoji: '\u{1F510}'
    },
    invalid_credentials: {
        message: {
            id: 'Credentials tidak valid',
            en: 'Invalid credentials'
        },
        suggestion: {
            id: 'Periksa App ID, Secret, dan Token Anda di Settings.',
            en: 'Check your App ID, Secret, and Token in Settings.'
        },
        emoji: '\u{1F511}'
    },

    '403': {
        message: {
            id: 'Akses ditolak',
            en: 'Access denied'
        },
        suggestion: {
            id: 'Fitur ini mungkin memerlukan langganan Qobuz premium.',
            en: 'This feature may require a premium Qobuz subscription.'
        },
        emoji: '\u{26A0}\u{FE0F}'
    },
    subscription_required: {
        message: {
            id: 'Langganan premium diperlukan',
            en: 'Premium subscription required'
        },
        suggestion: {
            id: 'Kualitas Hi-Res memerlukan langganan Qobuz Studio atau Studio Premier.',
            en: 'Hi-Res quality requires a Qobuz Studio or Studio Premier subscription.'
        },
        emoji: '\u{1F48E}'
    },

    ENOSPC: {
        message: {
            id: 'Disk penuh',
            en: 'Disk full'
        },
        suggestion: {
            id: 'Hapus beberapa file untuk membuat ruang.',
            en: 'Delete some files to free up space.'
        },
        emoji: '\u{1F4BE}'
    },
    EACCES: {
        message: {
            id: 'Tidak punya izin',
            en: 'Permission denied'
        },
        suggestion: {
            id: 'Periksa izin folder download atau jalankan sebagai administrator.',
            en: 'Check the download folder permissions or run as administrator.'
        },
        emoji: '\u{1F6AB}'
    },
    ENOENT: {
        message: {
            id: 'File atau folder tidak ditemukan',
            en: 'File or folder not found'
        },
        suggestion: {
            id: 'Pastikan path yang Anda masukkan benar.',
            en: 'Make sure the path you entered is correct.'
        },
        emoji: '\u{1F4C1}'
    },

    '404': {
        message: {
            id: 'Konten tidak ditemukan',
            en: 'Content not found'
        },
        suggestion: {
            id: 'Track, album, atau playlist mungkin tidak tersedia lagi.',
            en: 'The track, album, or playlist may no longer be available.'
        },
        emoji: '\u{1F50D}'
    },
    '429': {
        message: {
            id: 'Terlalu banyak permintaan',
            en: 'Too many requests'
        },
        suggestion: {
            id: 'Tunggu beberapa saat sebelum mencoba lagi.',
            en: 'Wait a moment before trying again.'
        },
        emoji: '\u{23F3}'
    },
    '500': {
        message: {
            id: 'Server Qobuz bermasalah',
            en: 'Qobuz server error'
        },
        suggestion: {
            id: 'Ini masalah dari Qobuz. Coba lagi nanti.',
            en: 'This is a Qobuz-side issue. Try again later.'
        },
        emoji: '\u{1F527}'
    },

    track_restricted: {
        message: {
            id: 'Track tidak tersedia di wilayah Anda',
            en: 'Track unavailable in your region'
        },
        suggestion: {
            id: 'Beberapa konten dibatasi berdasarkan lokasi geografis.',
            en: 'Some content is restricted by geographic location.'
        },
        emoji: '\u{1F30D}'
    },
    no_streamable: {
        message: {
            id: 'Track tidak dapat di-stream',
            en: 'Track cannot be streamed'
        },
        suggestion: {
            id: 'Track ini mungkin tidak tersedia untuk download.',
            en: 'This track may not be available for download.'
        },
        emoji: '\u{1F6AB}'
    }
};

function localizeError(info: LocalizedErrorInfo, locale: SupportedLocale): ErrorInfo {
    return {
        message: info.message[locale] || info.message.id,
        suggestion: info.suggestion[locale] || info.suggestion.id,
        emoji: info.emoji
    };
}

export function humanizeError(
    error: Error | string | unknown,
    locale: SupportedLocale = 'id'
): ErrorInfo {
    const errorString = error instanceof Error ? error.message : String(error);
    const normalized = errorString.toLowerCase();

    for (const [pattern, info] of Object.entries(ERROR_PATTERNS)) {
        if (errorString.includes(pattern) || normalized.includes(pattern.toLowerCase())) {
            return localizeError(info, locale);
        }
    }

    return {
        message: locale === 'id' ? 'Terjadi kesalahan' : 'An error occurred',
        suggestion:
            locale === 'id'
                ? `Detail: ${errorString.slice(0, 100)}`
                : `Details: ${errorString.slice(0, 100)}`,
        emoji: '\u{274C}'
    };
}

export function formatErrorForAPI(
    error: Error | string | unknown,
    locale: SupportedLocale = 'id'
): {
    error: string;
    suggestion: string;
    code: string;
} {
    const info = humanizeError(error, locale);
    const errorString = error instanceof Error ? error.message : String(error);

    return {
        error: info.message,
        suggestion: info.suggestion,
        code: extractErrorCode(errorString)
    };
}

function extractErrorCode(errorString: string): string {
    const httpMatch = errorString.match(/\b(4\d{2}|5\d{2})\b/);
    if (httpMatch) return httpMatch[1];

    const nodeMatch = errorString.match(/\b(E[A-Z]+)\b/);
    if (nodeMatch) return nodeMatch[1];

    return 'UNKNOWN';
}

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
    formatErrorForAPI,
    errorChecks
};
