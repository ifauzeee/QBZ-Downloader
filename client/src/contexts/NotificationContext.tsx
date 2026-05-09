import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { smartFetch } from '../utils/api';
import { useToast } from './ToastContext';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: string;
    read: boolean;
    data?: any;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    markAsRead: (id: string) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    deleteNotification: (id: string) => Promise<void>;
    clearAll: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { socket } = useSocket();
    const { showToast } = useToast();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await smartFetch('/api/notifications');
            if (res && res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
            
            const countRes = await smartFetch('/api/notifications/unread/count');
            if (countRes && countRes.ok) {
                const { count } = await countRes.json();
                setUnreadCount(count);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    useEffect(() => {
        if (!socket) return;

        const handleNewNotification = (notification: Notification) => {
            setNotifications(prev => [notification, ...prev].slice(0, 100));
            
            // Show toast for new notifications if they are important
            if (notification.type === 'error' || notification.type === 'warning' || notification.type === 'success') {
                showToast(notification.message, notification.type as any);
            }
        };

        const handleUnreadCount = (count: number) => {
            setUnreadCount(count);
        };

        const handleHistory = (history: Notification[]) => {
            setNotifications(history);
        };

        socket.on('notification:new', handleNewNotification);
        socket.on('notifications:unreadCount', handleUnreadCount);
        socket.on('notifications:history', handleHistory);

        return () => {
            socket.off('notification:new', handleNewNotification);
            socket.off('notifications:unreadCount', handleUnreadCount);
            socket.off('notifications:history', handleHistory);
        };
    }, [socket, showToast]);

    const markAsRead = async (id: string) => {
        try {
            const res = await smartFetch(`/api/notifications/${id}/read`, { method: 'POST' });
            if (res && res.ok) {
                setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const res = await smartFetch('/api/notifications/read-all', { method: 'POST' });
            if (res && res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const deleteNotification = async (id: string) => {
        try {
            const res = await smartFetch(`/api/notifications/${id}`, { method: 'DELETE' });
            if (res && res.ok) {
                setNotifications(prev => prev.filter(n => n.id !== id));
                // Recalculate unread if necessary, but the backend will emit unreadCount update
            }
        } catch (error) {
            console.error('Failed to delete notification:', error);
        }
    };

    const clearAll = async () => {
        try {
            const res = await smartFetch('/api/notifications', { method: 'DELETE' });
            if (res && res.ok) {
                setNotifications([]);
                setUnreadCount(0);
            }
        } catch (error) {
            console.error('Failed to clear notifications:', error);
        }
    };

    return (
        <NotificationContext.Provider value={{ 
            notifications, 
            unreadCount, 
            markAsRead, 
            markAllAsRead, 
            deleteNotification, 
            clearAll 
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
