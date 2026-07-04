import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtistDetailView } from '../ArtistDetailView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  showToast: vi.fn(),
  navigate: vi.fn(),
  setActiveTab: vi.fn(),
  addToStaging: vi.fn(),
  settings: {},
  navData: null,
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
    navigate: mocks.navigate,
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

const artistData = {
  id: '123',
  name: 'Test Artist',
  image: { large: 'https://example.com/cover.jpg' },
  biography: { en: 'A long biography. '.repeat(30) },
  tracks: {
    items: [
      { id: 't1', title: 'Track One', duration: 240, track_number: 1, performer: { name: 'Test Artist' } },
      { id: 't2', title: 'Track Two', duration: 180, track_number: 2, performer: { name: 'Test Artist' } },
    ],
  },
  albums: {
    items: [
      { id: 'a1', title: 'Album One', image: { small: '' }, release_date_original: '2024-01-15',
        maximum_bit_depth: 24, maximum_sampling_rate: 96 },
    ],
  },
  similar_artists: {
    items: [{ id: 'sa1', name: 'Similar Artist', image: { small: '' } }],
  },
};

describe('ArtistDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.navData = { id: '123' };
  });

  it('shows no artist selected when no navData.id', () => {
    mocks.navData = null;
    render(<ArtistDetailView />);
    expect(screen.getByText('No artist selected')).toBeInTheDocument();
    expect(screen.getByText('Back to Search')).toBeInTheDocument();
  });

  it('shows loading skeleton while fetching', () => {
    mocks.smartFetch.mockReturnValue(new Promise(() => {}));
    render(<ArtistDetailView />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(null, false));
    render(<ArtistDetailView />);
    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
  });

  it('renders artist details with tracks and albums', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);
    await waitFor(() => {
      expect(screen.getByText('Test Artist')).toBeInTheDocument();
      expect(screen.getByText('Track One')).toBeInTheDocument();
      expect(screen.getByText('Track Two')).toBeInTheDocument();
      expect(screen.getByText('Album One')).toBeInTheDocument();
    });
  });

  it('renders similar artists section', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);
    await waitFor(() => {
      expect(screen.getByText('Similar Artist')).toBeInTheDocument();
    });
  });

  it('shows read more / read less for long biography', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);
    await waitFor(() => expect(screen.getByText(/Read more/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Read more/));
    expect(screen.getByText(/Read less/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Read less/));
    expect(screen.getByText(/Read more/)).toBeInTheDocument();
  });

  it('fetches artist data on mount with navData.id', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);
    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/artist/123?limit=20');
    });
  });
});
