import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsView } from '../AnalyticsView';

vi.mock('react-chartjs-2', () => ({
  Line: () => null,
}));

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
}));

vi.mock('../../utils/api', () => ({
  smartFetch: mocks.smartFetch,
}));

vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const analyticsData = {
  summary: {
    totalTracks: 5000,
    totalDuration: '12 days 8 hours',
    totalArtists: 250,
    totalSize: '120 GB',
    downloadsToday: 15,
    downloadsThisWeek: 89,
    downloadsThisMonth: 350,
    averageDaily: 12.5,
  },
  insights: ['Your library is growing!', 'Consider upgrading FLAC files'],
  qualityDistribution: [
    { label: 'MP3 320', quality: 5, percentage: 20 },
    { label: 'FLAC 16/44.1', quality: 6, percentage: 60 },
    { label: 'FLAC 24/96', quality: 7, percentage: 20 },
  ],
  genreBreakdown: [
    { genre: 'Rock', count: 150, percentage: 30 },
    { genre: 'Electronic', count: 100, percentage: 20 },
  ],
  topArtists: [
    { name: 'Artist One', trackCount: 50, imageUrl: '' },
    { name: 'Artist Two', trackCount: 40, imageUrl: '' },
  ],
  trends: {
    daily: [
      { period: '2026-06-01', downloads: 5 },
      { period: '2026-06-02', downloads: 8 },
    ],
  },
};

function mockResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

describe('AnalyticsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mocks.smartFetch.mockReturnValue(new Promise(() => {}));
    render(<AnalyticsView />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows empty state when fetch fails', async () => {
    mocks.smartFetch.mockRejectedValue(new Error('network error'));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('msg_no_results')).toBeInTheDocument();
    });
  });

  it('renders summary cards with data', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('5000')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('120 GB')).toBeInTheDocument();
    });
  });

  it('renders quick stats row', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('89')).toBeInTheDocument();
      expect(screen.getByText('350')).toBeInTheDocument();
    });
  });

  it('renders top artists list', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('Artist One')).toBeInTheDocument();
      expect(screen.getByText('50 tracks')).toBeInTheDocument();
    });
  });

  it('renders quality distribution bars', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('MP3 320')).toBeInTheDocument();
      expect(screen.getByText('FLAC 16/44.1')).toBeInTheDocument();
      expect(screen.getByText('FLAC 24/96')).toBeInTheDocument();
    });
  });

  it('renders genre breakdown', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('Rock')).toBeInTheDocument();
      expect(screen.getByText('Electronic')).toBeInTheDocument();
    });
  });

  it('renders insights list', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText('Your library is growing!')).toBeInTheDocument();
    });
  });

  it('renders download trends chart section', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => {
      expect(screen.getByText(/Download Trends/)).toBeInTheDocument();
    });
  });

  it('refresh button reloads data', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);
    await waitFor(() => expect(screen.getByText('5000')).toBeInTheDocument());
    mocks.smartFetch.mockClear();
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    fireEvent.click(screen.getByText(/Refresh/));
    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/analytics/dashboard');
    });
  });
});
