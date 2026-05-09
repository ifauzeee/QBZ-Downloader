import React from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { Icons } from './Icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

interface NotificationsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();

    if (!isOpen) return null;

    const getIcon = (type: string) => {
        switch (type) {
            case 'success': return <Icons.Check color="var(--success)" />;
            case 'error': return <Icons.Close color="var(--danger)" />;
            case 'warning': return <Icons.Warning color="var(--warning)" />;
            default: return <Icons.Info color="var(--accent)" />;
        }
    };

    return (
        <div className="notifications-overlay" onClick={onClose}>
            <motion.div 
                className="notifications-panel"
                initial={{ opacity: 0, x: 300 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 300 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="notifications-header">
                    <div className="header-title">
                        <h3>{t('title_notifications')}</h3>
                        {unreadCount > 0 && <span className="unread-badge">{unreadCount} {t('label_new')}</span>}
                    </div>
                    <div className="header-actions">
                        {notifications.length > 0 && (
                            <button className="btn-text" onClick={markAllAsRead}>{t('action_mark_all_read')}</button>
                        )}
                        <button className="btn icon-btn" onClick={onClose}>
                            <Icons.Close />
                        </button>
                    </div>
                </div>

                <div className="notifications-list">
                    <AnimatePresence initial={false}>
                        {notifications.length === 0 ? (
                            <div className="empty-notifications">
                                <span className="empty-icon">🔔</span>
                                <p>{t('msg_no_notifications')}</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <motion.div 
                                    key={notif.id}
                                    className={`notification-item ${notif.read ? 'read' : 'unread'}`}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: 50 }}
                                    onClick={() => !notif.read && markAsRead(notif.id)}
                                >
                                    <div className="notification-icon">
                                        {getIcon(notif.type)}
                                    </div>
                                    <div className="notification-content">
                                        <div className="notification-title">{notif.title}</div>
                                        <div className="notification-message">{notif.message}</div>
                                        <div className="notification-time">
                                            {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                    <button 
                                        className="delete-btn" 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(notif.id);
                                        }}
                                    >
                                        <Icons.Close width={14} height={14} />
                                    </button>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>

                {notifications.length > 0 && (
                    <div className="notifications-footer">
                        <button className="btn secondary full-width" onClick={clearAll}>
                            {t('action_clear')}
                        </button>
                    </div>
                )}
            </motion.div>

            <style>{`
                .notifications-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 3000;
                    background: rgba(0,0,0,0.2);
                    backdrop-filter: blur(2px);
                }
                .notifications-panel {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 380px;
                    background: var(--bg-card);
                    border-left: 1px solid var(--border);
                    display: flex;
                    flex-direction: column;
                    box-shadow: -10px 0 30px rgba(0,0,0,0.3);
                }
                @media (max-width: 480px) {
                    .notifications-panel { width: 100%; }
                }
                .notifications-header {
                    padding: 20px;
                    border-bottom: 1px solid var(--border);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .header-title { display: flex; alignItems: center; gap: 12px; }
                .header-title h3 { margin: 0; font-size: 1.2rem; font-weight: 700; }
                .unread-badge {
                    background: var(--accent);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .btn-text {
                    background: none;
                    border: none;
                    color: var(--accent);
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .btn-text:hover { background: rgba(var(--accent-rgb), 0.1); }
                .notifications-list {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                .notification-item {
                    position: relative;
                    padding: 16px;
                    border-radius: 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid var(--border);
                    display: flex;
                    gap: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .notification-item:hover {
                    background: rgba(255,255,255,0.04);
                    transform: translateX(-4px);
                }
                .notification-item.unread {
                    border-left: 4px solid var(--accent);
                    background: rgba(var(--accent-rgb), 0.05);
                }
                .notification-icon {
                    width: 40px;
                    height: 40px;
                    border-radius: 12px;
                    background: rgba(255,255,255,0.03);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .notification-content { flex: 1; min-width: 0; }
                .notification-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary); }
                .notification-message { font-size: 0.85rem; color: var(--text-secondary); line-height: 1.4; }
                .notification-time { font-size: 0.75rem; color: var(--text-secondary); opacity: 0.6; margin-top: 8px; }
                .delete-btn {
                    position: absolute;
                    top: 12px;
                    right: 12px;
                    opacity: 0;
                    background: none;
                    border: none;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: opacity 0.2s;
                }
                .notification-item:hover .delete-btn { opacity: 1; }
                .empty-notifications {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-secondary);
                    opacity: 0.5;
                }
                .empty-icon { font-size: 3rem; margin-bottom: 16px; }
                .notifications-footer { padding: 20px; border-top: 1px solid var(--border); }
                .full-width { width: 100%; }
            `}</style>
        </div>
    );
};
