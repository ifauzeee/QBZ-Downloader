import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NotificationService, notifyDownloadComplete, notifyDownloadError } from './notifications.js';

// Mock dependencies
vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        success: vi.fn()
    }
}));

describe('NotificationService', () => {
    let service: NotificationService;

    beforeEach(() => {
        service = new NotificationService();
    });

    it('should create notifications of different types', () => {
        service.success('S', 'Msg');
        service.error('E', 'Msg');
        service.warning('W', 'Msg');
        service.info('I', 'Msg');

        expect(service.getAll().length).toBe(4);
        expect(service.getByType('success').length).toBe(1);
    });

    it('should limit the number of notifications', () => {
        // Set maxNotifications to 3 for testing (private but we can cast or just use the default 100)
        (service as any).maxNotifications = 3;
        
        service.info('1', 'M');
        service.info('2', 'M');
        service.info('3', 'M');
        service.info('4', 'M');

        expect(service.getAll().length).toBe(3);
        expect(service.getAll()[0].title).toBe('4'); // Most recent first
    });

    it('should mark notifications as read', () => {
        const n = service.info('T', 'M');
        expect(service.getUnreadCount()).toBe(1);
        
        service.markAsRead(n.id);
        expect(service.getUnreadCount()).toBe(0);
        expect(service.getUnread().length).toBe(0);
    });

    it('should emit events on notification', () => {
        const spy = vi.fn();
        service.on('notification', spy);
        
        service.success('T', 'M');
        expect(spy).toHaveBeenCalled();
    });

    describe('Helper Functions', () => {
        it('should create correct download complete notification', () => {
            const n = notifyDownloadComplete('Song Title', '/path/to/file');
            expect(n.title).toBe('Download Complete');
            expect(n.data.filePath).toBe('/path/to/file');
        });

        it('should create correct download error notification', () => {
            const n = notifyDownloadError('Song Title', 'Timeout');
            expect(n.type).toBe('error');
            expect(n.data.error).toBe('Timeout');
        });
    });
});
