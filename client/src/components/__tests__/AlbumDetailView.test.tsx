import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumDetailView } from '../AlbumDetailView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  showToast: vi.fn(),
  setActiveTab: vi.fn(),
  addToStaging: vi.fn(),
  settings: {} as Record<string, unknown>,
  navData: null as { id: string } | null,
}));

vi.mock('../../utils/api', () => ({
  smartFetch: mocks.smartFetch,
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

vi.mock('../../contexts/NavigationContext', () => ({
  useNavigation: () => ({
    navData: mocks.navData,
    setActiveTab: mocks.setActiveTab,
  }),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    addToStaging: mocks.addToStaging,
    settings: mocks.settings,
  }),
}));

function mockResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

const albumData = {
  id: 'a1',
  title: 'Test Album Title',
  artist: { name: 'Test Artist' },
  image: {
    large: 'https://example.com/large.jpg',
    medium: 'https://example.com/med.jpg',
    small: 'https://example.com/small.jpg',
  },
  tracks: {
    items: [
      { id: 't1', title: 'Track One', duration: 240, track_number: 1, performer: { name: 'Test Artist' } },
      { id: 't2', title: 'Track Two', duration: 300, track_number: 2, performer: { name: 'Test Artist' } },
    ],
  },
  duration: 540,
  track_count: 2,
  genre: { name: 'Rock' },
  release_date_original: '2024-01-15',
  label: { name: 'Test Label' },
  maximum_bit_depth: 24,
  maximum_sampling_rate: 96,
  hires: true,
};

describe('AlbumDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.navData = { id: 'a1' };
  });

  it('shows no album selected when no navData.id', () => {
    mocks.navData = null;
    render(<AlbumDetailView />);
    expect(screen.getByText('No Album Selected')).toBeInTheDocument();
    expect(screen.getByText('Back to Search')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mocks.smartFetch.mockReturnValue(new Promise(() => {}));
    render(<AlbumDetailView />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(null, false));
    render(<AlbumDetailView />);
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('renders album details with tracks', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      expect(screen.getByText('Test Album Title')).toBeInTheDocument();
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('HI-RES 24/96')).toBeInTheDocument();
      expect(screen.getByText('Track One')).toBeInTheDocument();
      expect(screen.getByText('Track Two')).toBeInTheDocument();
    });
  });

  it('shows download album button', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /album/i })).toBeInTheDocument();
    });
  });

  it('opens download modal with ZIP and separate options', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const dlBtn = btns.find(b => b.textContent?.toLowerCase().includes('download') && b.textContent?.toLowerCase().includes('album'));
      expect(dlBtn).toBeDefined();
      fireEvent.click(dlBtn!);
    });
    expect(screen.getByText('Download as ZIP')).toBeInTheDocument();
    expect(screen.getByText('Separate Files')).toBeInTheDocument();
  });

  it('cancels modal', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const dlBtn = btns.find(b => b.textContent?.toLowerCase().includes('download') && b.textContent?.toLowerCase().includes('album'));
      fireEvent.click(dlBtn!);
    });
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Download as ZIP')).not.toBeInTheDocument();
  });

  it('queues album download via separate files', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const dlBtn = btns.find(b => b.textContent?.toLowerCase().includes('download') && b.textContent?.toLowerCase().includes('album'));
      fireEvent.click(dlBtn!);
    });
    mocks.smartFetch.mockResolvedValue(mockResponse({ success: true }));
    fireEvent.click(screen.getByText('Separate Files'));
    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/add', expect.objectContaining({
        method: 'POST', body: JSON.stringify({ type: 'album', id: 'a1' }),
      }));
    });
  });

  it('fetches album on mount with navData.id', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);
    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/album/a1');
    });
  });
});
