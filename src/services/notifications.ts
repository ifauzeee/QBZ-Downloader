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

class NotificationService extends EventEmitter {
    private notifications: Notification[] = [];
    private maxNotifications: number = 100;
    private idCounter: number = 0;

    constructor() {
        super();
    }

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

    success(title: string, message: string, data?: any): Notification {
        logger.success(`[Notification] ${title}: ${message}`);
        return this.notify('success', title, message, data);
    }

    error(title: string, message: string, data?: any): Notification {
        logger.error(`[Notification] ${title}: ${message}`);
        return this.notify('error', title, message, data);
    }

    warning(title: string, message: string, data?: any): Notification {
        logger.warn(`[Notification] ${title}: ${message}`);
        return this.notify('warning', title, message, data);
    }

    info(title: string, message: string, data?: any): Notification {
        logger.info(`[Notification] ${title}: ${message}`);
        return this.notify('info', title, message, data);
    }

    getAll(): Notification[] {
        return this.notifications;
    }

    getUnread(): Notification[] {
        return this.notifications.filter((n) => !n.read);
    }

    getUnreadCount(): number {
        return this.notifications.filter((n) => !n.read).length;
    }

    markAsRead(id: string): boolean {
        const notification = this.notifications.find((n) => n.id === id);
        if (notification) {
            notification.read = true;
            this.emit('notification:read', notification);
            return true;
        }
        return false;
    }

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

    delete(id: string): boolean {
        const index = this.notifications.findIndex((n) => n.id === id);
        if (index !== -1) {
            this.notifications.splice(index, 1);
            return true;
        }
        return false;
    }

    clearAll(): void {
        this.notifications = [];
        this.emit('notifications:cleared');
    }

    getByType(type: NotificationType): Notification[] {
        return this.notifications.filter((n) => n.type === type);
    }

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

export function notifyBatchZipCreated(zipName: string, path: string): Notification {
    return notificationService.success('Batch ZIP Created', `ZIP archive "${zipName}" is ready.`, {
        zipName,
        path
    });
}
