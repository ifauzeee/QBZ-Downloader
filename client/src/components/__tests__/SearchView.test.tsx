import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchView } from '../SearchView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  showToast: vi.fn(),
  navigate: vi.fn(),
  addToStaging: vi.fn(),
  settings: {},
  searchState: { query: '', type: 'albums', results: [], total: 0, page: 0 },
  setSearchState: vi.fn(),
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
    navigate: mocks.navigate,
    searchState: mocks.searchState,
    setSearchState: mocks.setSearchState,
  }),
}));

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    addToStaging: mocks.addToStaging,
    settings: mocks.settings,
  }),
}));

describe('SearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchState.query = '';
    mocks.searchState.type = 'albums';
    mocks.searchState.results = [];
    mocks.searchState.total = 0;
    mocks.searchState.page = 0;
  });

  it('shows start searching empty state', () => {
    render(<SearchView />);
    expect(screen.getByText('msg_start_searching')).toBeInTheDocument();
    expect(screen.getByText('msg_enter_keywords')).toBeInTheDocument();
  });

  it('shows no results empty state after search with no results', () => {
    mocks.searchState.query = 'test';
    render(<SearchView />);
    expect(screen.getByText('msg_no_results')).toBeInTheDocument();
    expect(screen.getByText('msg_try_keywords')).toBeInTheDocument();
  });

  it('renders search type buttons', () => {
    render(<SearchView />);
    expect(screen.getByText('Albums')).toBeInTheDocument();
    expect(screen.getByText('Tracks')).toBeInTheDocument();
    expect(screen.getByText('Artists')).toBeInTheDocument();
  });

  it('changes search type via handler', () => {
    render(<SearchView />);
    fireEvent.click(screen.getByText('Artists'));
    expect(mocks.setSearchState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders search input with placeholder', () => {
    render(<SearchView />);
    expect(screen.getByPlaceholderText('common_search_placeholder')).toBeInTheDocument();
  });

  it('renders results in list view', async () => {
    mocks.searchState.query = 'test';
    mocks.searchState.results = [
      { id: '1', title: 'Album One', artist: { name: 'Artist A' }, image: {} },
      { id: '2', title: 'Album Two', artist: { name: 'Artist B' }, image: {} },
    ];
    mocks.searchState.total = 2;
    render(<SearchView />);
    await waitFor(() => {
      expect(screen.getByText('Album One')).toBeInTheDocument();
      expect(screen.getByText('Artist A')).toBeInTheDocument();
    });
  });

  it('shows pagination when total exceeds limit', async () => {
    mocks.searchState.query = 'test';
    mocks.searchState.results = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), title: `Track ${i}`, artist: {}, image: {},
    }));
    mocks.searchState.total = 50;
    render(<SearchView />);
    await waitFor(() => {
      expect(document.getElementById('search-pagination')).toBeInTheDocument();
    });
    const pagination = document.getElementById('search-pagination');
    expect(pagination).not.toBeNull();
    expect(pagination!.textContent).toContain('label_page');
    expect(pagination!.textContent).toContain('label_next');
  });

  it('toggles hi-res filter', () => {
    render(<SearchView />);
    expect(screen.getByText('label_hires_only')).toBeInTheDocument();
    fireEvent.click(screen.getByText('label_hires_only'));
  });

  it('renders hi-res badge for hi-res results', () => {
    mocks.searchState.query = 'test';
    mocks.searchState.results = [{
      id: '1', title: 'Hi-Res Album', artist: { name: 'Artist' }, image: {},
      hires: true, maximum_bit_depth: 24, maximum_sampling_rate: 96,
    }];
    mocks.searchState.total = 1;
    render(<SearchView />);
    expect(screen.getByText(/24-bit/)).toBeInTheDocument();
  });
});
