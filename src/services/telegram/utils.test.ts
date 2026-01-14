import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    formatSize,
    formatDuration,
    formatSpeed,
    getTypeIcon,
    getStatusIcon,
    createProgressBar,
    truncate,
    generateQueueId,
    parseDownloadCallback,
    createDownloadCallback,
    calculateEta,
    createKeyboard
} from '../telegram/utils.js';

describe('escapeHtml', () => {
    it('should escape ampersand', () => {
        expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('should escape less than', () => {
        expect(escapeHtml('a < b')).toBe('a &lt; b');
    });

    it('should escape greater than', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('should escape multiple special characters', () => {
        expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
            '&lt;script&gt;alert("XSS")&lt;/script&gt;'
        );
    });

    it('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    it('should return empty for null/undefined', () => {
        expect(escapeHtml(null as any)).toBe('');
        expect(escapeHtml(undefined as any)).toBe('');
    });
});

describe('formatSize', () => {
    it('should format 0 bytes', () => {
        expect(formatSize(0)).toBe('0 B');
    });

    it('should format bytes', () => {
        expect(formatSize(512)).toBe('512 B');
    });

    it('should format kilobytes', () => {
        expect(formatSize(1024)).toBe('1 KB');
        expect(formatSize(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
        expect(formatSize(1048576)).toBe('1 MB');
        expect(formatSize(5242880)).toBe('5 MB');
    });

    it('should format gigabytes', () => {
        expect(formatSize(1073741824)).toBe('1 GB');
    });
});

describe('formatDuration', () => {
    it('should format seconds', () => {
        expect(formatDuration(45)).toBe('0:45');
    });

    it('should format minutes and seconds', () => {
        expect(formatDuration(125)).toBe('2:05');
    });

    it('should format hours', () => {
        expect(formatDuration(3661)).toBe('1:01:01');
    });
});

describe('formatSpeed', () => {
    it('should format speed with units', () => {
        expect(formatSpeed(1048576)).toBe('1 MB/s');
        expect(formatSpeed(2097152)).toBe('2 MB/s');
    });
});

describe('getTypeIcon', () => {
    it('should return correct icons', () => {
        expect(getTypeIcon('track')).toBe('🎵');
        expect(getTypeIcon('album')).toBe('💿');
        expect(getTypeIcon('playlist')).toBe('📜');
        expect(getTypeIcon('artist')).toBe('👤');
    });
});

describe('getStatusIcon', () => {
    it('should return correct icons', () => {
        expect(getStatusIcon('pending')).toBe('⏳');
        expect(getStatusIcon('downloading')).toBe('📥');
        expect(getStatusIcon('completed')).toBe('✅');
        expect(getStatusIcon('failed')).toBe('❌');
    });
});

describe('createProgressBar', () => {
    it('should create empty bar at 0%', () => {
        expect(createProgressBar(0)).toBe('⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪');
    });

    it('should create full bar at 100%', () => {
        expect(createProgressBar(100)).toBe('🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢');
    });

    it('should create partial bar', () => {
        expect(createProgressBar(50)).toBe('🟢🟢🟢🟢🟢🟢⚪⚪⚪⚪⚪⚪');
    });

    it('should support custom length', () => {
        expect(createProgressBar(50, 10)).toBe('🟢🟢🟢🟢🟢⚪⚪⚪⚪⚪');
    });
});

describe('truncate', () => {
    it('should not truncate short strings', () => {
        expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should truncate long strings', () => {
        expect(truncate('This is a very long string', 10)).toBe('This is...');
    });

    it('should handle empty string', () => {
        expect(truncate('', 10)).toBe('');
    });
});

describe('generateQueueId', () => {
    it('should generate unique IDs', () => {
        const id1 = generateQueueId();
        const id2 = generateQueueId();

        expect(id1).not.toBe(id2);
    });

    it('should start with q_', () => {
        expect(generateQueueId()).toMatch(/^q_/);
    });
});

describe('parseDownloadCallback', () => {
    it('should parse valid callback data', () => {
        const result = parseDownloadCallback('dl_track_123abc_27');

        expect(result).toEqual({
            type: 'track',
            id: '123abc',
            quality: 27
        });
    });

    it('should return null for invalid data', () => {
        expect(parseDownloadCallback('invalid')).toBeNull();
        expect(parseDownloadCallback('dl_invalid_123')).toBeNull();
    });
});

describe('createDownloadCallback', () => {
    it('should create valid callback data', () => {
        expect(createDownloadCallback('track', '123', 27)).toBe('dl_track_123_27');
        expect(createDownloadCallback('album', 456, 6)).toBe('dl_album_456_6');
    });
});

describe('calculateEta', () => {
    it('should calculate ETA', () => {
        expect(calculateEta(1073741824, 1048576)).toBe('17:04');
    });

    it('should return --:-- for zero speed', () => {
        expect(calculateEta(1000, 0)).toBe('--:--');
    });
});

describe('createKeyboard', () => {
    it('should create keyboard structure', () => {
        const keyboard = createKeyboard([
            [{ text: 'Button 1', callback_data: 'cb1' }],
            [{ text: 'Button 2', callback_data: 'cb2' }]
        ]);

        expect(keyboard).toEqual({
            inline_keyboard: [
                [{ text: 'Button 1', callback_data: 'cb1' }],
                [{ text: 'Button 2', callback_data: 'cb2' }]
            ]
        });
    });
});
