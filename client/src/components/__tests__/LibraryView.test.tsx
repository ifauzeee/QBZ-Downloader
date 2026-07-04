import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LibraryView } from '../LibraryView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  showToast: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn() },
}));

vi.mock('../../utils/api', () => ({
  smartFetch: mocks.smartFetch,
}));

vi.mock('../../contexts/SocketContext', () => ({
  useSocket: () => ({ socket: mocks.socket }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

function mockResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

describe('LibraryView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.socket.on.mockReset();
    mocks.socket.off.mockReset();
  });

  it('shows loading skeleton on mount', () => {
    mocks.smartFetch.mockReturnValue(new Promise(() => {}));
    render(<LibraryView />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('loads and displays library stats', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({
      totalFiles: 1000, duplicates: 5, upgradeable: 10, totalSize: 5000000000, FFMPEG_AVAILABLE: true,
    }));
    render(<LibraryView />);
    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('shows FFmpeg warning when not available', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({
      totalFiles: 100, duplicates: 0, upgradeable: 0, totalSize: 0, FFMPEG_AVAILABLE: false,
    }));
    render(<LibraryView />);
    await waitFor(() => {
      expect(screen.getByText(/FFmpeg Not Found/i)).toBeInTheDocument();
    });
  });

  it('switches tabs and loads tab data', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({
      totalFiles: 500, duplicates: 2, upgradeable: 3, totalSize: 1000, FFMPEG_AVAILABLE: true,
    }));
    render(<LibraryView />);
    await waitFor(() => expect(screen.getByText('500')).toBeInTheDocument());

    const tabs = screen.getAllByRole('button');
    const dupTab = tabs.find(b => b.textContent?.includes('tab_duplicates'));
    const upgTab = tabs.find(b => b.textContent?.includes('tab_upgradeable'));
    const metaTab = tabs.find(b => b.textContent?.includes('Metadata'));
    expect(dupTab).toBeDefined();
    expect(upgTab).toBeDefined();
    expect(metaTab).toBeDefined();

    fireEvent.click(dupTab!);
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/duplicates');

    fireEvent.click(upgTab!);
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/upgradeable');

    fireEvent.click(metaTab!);
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/missing-metadata');
  });

  it('starts a library scan', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({ totalFiles: 0, duplicates: 0, upgradeable: 0, totalSize: 0, FFMPEG_AVAILABLE: true }));
    render(<LibraryView />);
    await waitFor(() => expect(screen.getByText('action_scan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('action_scan'));
    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/scan', expect.objectContaining({ method: 'POST' }));
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Scan started', 'success');
  });

  it('listens to socket scan events on mount', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({ totalFiles: 0, duplicates: 0, upgradeable: 0, totalSize: 0, FFMPEG_AVAILABLE: true }));
    render(<LibraryView />);
    expect(mocks.socket.on).toHaveBeenCalledWith('scan:progress', expect.any(Function));
    expect(mocks.socket.on).toHaveBeenCalledWith('scan:complete', expect.any(Function));
  });
});
