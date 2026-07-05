import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsPanel } from '../NotificationsPanel';

const mocks = vi.hoisted(() => ({
  notifications: [] as Array<{ id: string; type: string; title: string; message: string; timestamp: string; read: boolean }>,
  unreadCount: 0,
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock('../../contexts/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: mocks.notifications,
    unreadCount: mocks.unreadCount,
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
    deleteNotification: mocks.deleteNotification,
    clearAll: mocks.clearAll,
  }),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

describe('NotificationsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notifications = [];
    mocks.unreadCount = 0;
  });

  it('returns null when not open', () => {
    const { container } = render(<NotificationsPanel isOpen={false} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders empty state when open with no notifications', () => {
    render(<NotificationsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('msg_no_notifications')).toBeInTheDocument();
  });

  it('renders notifications when open', () => {
    mocks.notifications = [
      { id: '1', type: 'success', title: 'Download success', message: 'File downloaded', timestamp: new Date().toISOString(), read: false },
      { id: '2', type: 'error', title: 'Download error', message: 'Failed to download', timestamp: new Date().toISOString(), read: false },
    ];
    render(<NotificationsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Download success')).toBeInTheDocument();
    expect(screen.getByText('Download error')).toBeInTheDocument();
  });
});
