import { describe, it, expect } from 'vitest';
import {
    buildWelcomeMessage,
    buildHelpMessage,
    buildDownloadStartMessage,
    buildDownloadCompleteMessage,
    buildErrorMessage,
    buildProgressMessage,
    buildSearchMessage,
    buildQualitySelectMessage,
    buildQueuedMessage
} from '../telegram/messages.js';

describe('buildWelcomeMessage', () => {
    it('should contain welcome text', () => {
        const msg = buildWelcomeMessage();
        expect(msg).toContain('Welcome to Qobuz Premium Bot');
        expect(msg).toContain('/search');
        expect(msg).toContain('/settings');
    });
});

describe('buildHelpMessage', () => {
    it('should contain command list', () => {
        const msg = buildHelpMessage();
        expect(msg).toContain('/search');
        expect(msg).toContain('/queue');
        expect(msg).toContain('/settings');
        expect(msg).toContain('/help');
    });
});

describe('buildDownloadStartMessage', () => {
    it('should format download start message', () => {
        const msg = buildDownloadStartMessage('Test Track', 'track', 'FLAC 24/192');

        expect(msg).toContain('INCOMING DOWNLOAD');
        expect(msg).toContain('Test Track');
        expect(msg).toContain('FLAC 24/192');
        expect(msg).toContain('🎵');
    });

    it('should use correct icon for album', () => {
        const msg = buildDownloadStartMessage('Test Album', 'album', 'FLAC');
        expect(msg).toContain('💿');
    });

    it('should escape HTML in title', () => {
        const msg = buildDownloadStartMessage('<script>alert(1)</script>', 'track', 'FLAC');
        expect(msg).not.toContain('<script>');
        expect(msg).toContain('&lt;script&gt;');
    });
});

describe('buildDownloadCompleteMessage', () => {
    it('should format complete message with stats', () => {
        const msg = buildDownloadCompleteMessage('Test Album', '/path/to/album', {
            trackCount: 10,
            totalSize: 500000000
        });

        expect(msg).toContain('SUCCESSFULLY DOWNLOADED');
        expect(msg).toContain('Test Album');
        expect(msg).toContain('10');
    });

    it('should hide path when specified', () => {
        const msg = buildDownloadCompleteMessage(
            'Test Track',
            '/path/to/track.flac',
            undefined,
            false
        );

        expect(msg).not.toContain('/path/to/track.flac');
    });
});

describe('buildErrorMessage', () => {
    it('should format error message', () => {
        const msg = buildErrorMessage('Download', 'Network timeout');

        expect(msg).toContain('ERROR DETECTED');
        expect(msg).toContain('Download');
        expect(msg).toContain('Network timeout');
    });

    it('should escape HTML in error', () => {
        const msg = buildErrorMessage('Test', '<error>');
        expect(msg).toContain('&lt;error&gt;');
    });
});

describe('buildProgressMessage', () => {
    it('should format download progress', () => {
        const msg = buildProgressMessage('Track Title', 'download', 5000000, 10000000);

        expect(msg).toContain('Track Title');
        expect(msg).toContain('Downloading');
        expect(msg).toContain('50%');
    });

    it('should format lyrics phase', () => {
        const msg = buildProgressMessage('Track', 'lyrics', 0);
        expect(msg).toContain('Fetching Lyrics');
    });

    it('should format tagging phase', () => {
        const msg = buildProgressMessage('Track', 'tagging', 0);
        expect(msg).toContain('Tagging Metadata');
    });
});

describe('buildSearchMessage', () => {
    it('should format search message with query', () => {
        const msg = buildSearchMessage('Daft Punk');

        expect(msg).toContain('SEARCH OPERATOR');
        expect(msg).toContain('Daft Punk');
    });
});

describe('buildQualitySelectMessage', () => {
    it('should format quality selection', () => {
        const msg = buildQualitySelectMessage('track', '12345');

        expect(msg).toContain('SELECT AUDIO QUALITY');
        expect(msg).toContain('TRACK');
        expect(msg).toContain('12345');
    });
});

describe('buildQueuedMessage', () => {
    it('should format queued confirmation', () => {
        const msg = buildQueuedMessage('Test Track', 'track', 3);

        expect(msg).toContain('ADDED TO QUEUE');
        expect(msg).toContain('Test Track');
        expect(msg).toContain('#3');
    });
});
