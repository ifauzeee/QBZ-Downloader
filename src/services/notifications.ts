import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    data?: any;
}

/**
 * Notification Service
 * Centralized notification management with event-based push
 */
class NotificationService extends EventEmitter {
    private notifications: Notification[] = [];
    private maxNotifications: number = 100;
    private idCounter: number = 0;

    constructor() {
        super();
    }

    /**
     * Create and emit a notification
     */
    private notify(
        type: NotificationType,
        title: string,
        message: string,
        data?: any
    ): Notification {
        const notification: Notification = {
            id: `notif-${Date.now()}-${++this.idCounter}`,
            type,
            title,
            message,
            timestamp: new Date(),
            read: false,
            data
        };

        this.notifications.unshift(notification);

        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        this.emit('notification', notification);
        this.emit(`notification:${type}`, notification);

        return notification;
    }

    /**
     * Send success notification
     */
    success(title: string, message: string, data?: any): Notification {
        logger.success(`[Notification] ${title}: ${message}`);
        return this.notify('success', title, message, data);
    }

    /**
     * Send error notification
     */
    error(title: string, message: string, data?: any): Notification {
        logger.error(`[Notification] ${title}: ${message}`);
        return this.notify('error', title, message, data);
    }

    /**
     * Send warning notification
     */
    warning(title: string, message: string, data?: any): Notification {
        logger.warn(`[Notification] ${title}: ${message}`);
        return this.notify('warning', title, message, data);
    }

    /**
     * Send info notification
     */
    info(title: string, message: string, data?: any): Notification {
        logger.info(`[Notification] ${title}: ${message}`);
        return this.notify('info', title, message, data);
    }

    /**
     * Get all notifications
     */
    getAll(): Notification[] {
        return this.notifications;
    }

    /**
     * Get unread notifications
     */
    getUnread(): Notification[] {
        return this.notifications.filter((n) => !n.read);
    }

    /**
     * Get unread count
     */
    getUnreadCount(): number {
        return this.notifications.filter((n) => !n.read).length;
    }

    /**
     * Mark notification as read
     */
    markAsRead(id: string): boolean {
        const notification = this.notifications.find((n) => n.id === id);
        if (notification) {
            notification.read = true;
            this.emit('notification:read', notification);
            return true;
        }
        return false;
    }

    /**
     * Mark all as read
     */
    markAllAsRead(): number {
        let count = 0;
        for (const n of this.notifications) {
            if (!n.read) {
                n.read = true;
                count++;
            }
        }
        this.emit('notifications:allRead');
        return count;
    }

    /**
     * Delete notification
     */
    delete(id: string): boolean {
        const index = this.notifications.findIndex((n) => n.id === id);
        if (index !== -1) {
            this.notifications.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Clear all notifications
     */
    clearAll(): void {
        this.notifications = [];
        this.emit('notifications:cleared');
    }

    /**
     * Get notifications by type
     */
    getByType(type: NotificationType): Notification[] {
        return this.notifications.filter((n) => n.type === type);
    }

    /**
     * Get recent notifications
     */
    getRecent(limit: number = 10): Notification[] {
        return this.notifications.slice(0, limit);
    }
}

export const notificationService = new NotificationService();

export function notifyDownloadComplete(title: string, filePath?: string): Notification {
    return notificationService.success(
        'Download Complete',
        `"${title}" has been downloaded successfully.`,
        { filePath }
    );
}

export function notifyDownloadError(title: string, error: string): Notification {
    return notificationService.error('Download Failed', `Failed to download "${title}": ${error}`, {
        title,
        error
    });
}

export function notifyBatchComplete(imported: number, failed: number): Notification {
    if (failed === 0) {
        return notificationService.success(
            'Batch Import Complete',
            `Successfully imported ${imported} items to queue.`,
            { imported, failed }
        );
    } else {
        return notificationService.warning(
            'Batch Import Finished',
            `Imported ${imported} items, ${failed} failed.`,
            { imported, failed }
        );
    }
}

export function notifyTokenExpired(): Notification {
    return notificationService.error(
        'Token Expired',
        'Your Qobuz authentication token has expired. Please update it in Settings.',
        { action: 'update_token' }
    );
}

export function notifyQueueEmpty(): Notification {
    return notificationService.info('Queue Empty', 'All downloads have been completed!', {});
}
