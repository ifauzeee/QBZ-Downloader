import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueView } from '../QueueView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  fetchQueue: vi.fn(),
  setStats: vi.fn(),
  updateItemProgress: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn() },
  connected: true,
  stats: { total: 0, downloading: 0, completed: 0, failed: 0, pending: 0 },
  queue: [] as any[],
}));

vi.mock('../../utils/api', () => ({
  smartFetch: mocks.smartFetch,
  getQualityLabel: (q: number) => `Q${q}`,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: mocks.socket, connected: mocks.connected }),
}));

vi.mock('../../stores/queueStore', () => ({
  useQueueStore: (selector?: (state: any) => any) => {
    const state = {
      stats: mocks.stats,
      queue: mocks.queue,
      setStats: mocks.setStats,
      fetchQueue: mocks.fetchQueue,
      updateItemProgress: mocks.updateItemProgress,
    };
    return selector ? selector(state) : state;
  },
}));

function mockResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

describe('QueueView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stats = { total: 0, downloading: 0, completed: 0, failed: 0, pending: 0 };
    mocks.queue = [];
    mocks.connected = true;
    mocks.socket.on.mockReset();
  });

  it('shows empty state when queue is empty', () => {
    render(<QueueView />);
    expect(screen.getByText('msg_queue_empty')).toBeInTheDocument();
    expect(screen.getByText('msg_add_urls')).toBeInTheDocument();
  });

  it('renders stats cards with default zeros', () => {
    render(<QueueView />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(4);
  });

  it('renders stats with non-zero values', () => {
    mocks.stats = { total: 10, downloading: 2, completed: 5, failed: 1, pending: 2 };
    render(<QueueView />);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders toolbar with pause/resume/clear buttons', () => {
    render(<QueueView />);
    expect(screen.getByText('action_pause')).toBeInTheDocument();
    expect(screen.getByText('action_resume')).toBeInTheDocument();
    expect(screen.getByText('action_clear')).toBeInTheDocument();
  });

  it('sends pause action', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({}));
    render(<QueueView />);
    fireEvent.click(screen.getByText('action_pause'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/action', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ action: 'pause' }),
    }));
  });

  it('sends resume action', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({}));
    render(<QueueView />);
    fireEvent.click(screen.getByText('action_resume'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/action', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ action: 'resume' }),
    }));
  });

  it('sends clear action', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({}));
    render(<QueueView />);
    fireEvent.click(screen.getByText('action_clear'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/action', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ action: 'clear' }),
    }));
  });

  it('subscribes to socket events on mount', () => {
    render(<QueueView />);
    expect(mocks.socket.on).toHaveBeenCalledWith('queue:update', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('queue:stats', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('item:added', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('item:completed', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('item:failed', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('item:progress', expect.any(Function));
  });
});
