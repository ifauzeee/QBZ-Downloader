import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsPanel } from '../NotificationsPanel';

const mocks = vi.hoisted(() => ({
  notifications: [],
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
      { id: '1', message: 'Download complete', type: 'success', timestamp: Date.now() },
      { id: '2', message: 'Error occurred', type: 'error', timestamp: Date.now() },
    ];
    render(<NotificationsPanel isOpen={true} onClose={() => {}} />);
    expect(screen.getByText('Download complete')).toBeInTheDocument();
    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });
});
