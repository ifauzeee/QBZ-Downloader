# Phase 3: Testing & CI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reach >=75% component test coverage, add Electron smoke test, and optimize CI caching.

**Architecture:** 6 new component test files mirroring the existing pattern (BatchImportView.test.tsx), coverage threshold in vitest config, better-sqlite3 build caching via actions/cache, Playwright-based Electron smoke test on Windows-only merge-to-main.

**Tech Stack:** Vitest 4.1.6, @testing-library/react 16.3.2, @testing-library/jest-dom, playwright, zustand 5.x, chart.js 4.x, @tanstack/react-virtual 3.x, socket.io-client

---

### Task 1: Coverage dependency + vitest config

**Files:**
- Modify: `client/package.json` (add `@vitest/coverage-v8`)
- Modify: `client/vitest.config.ts` (add coverage config)

- [ ] **Step 1: Add `@vitest/coverage-v8` to client devDependencies**

```jsonc
// client/package.json — insert after "vitest": "^4.1.6",
"@vitest/coverage-v8": "^4.1.6",
```

- [ ] **Step 2: Update client/vitest.config.ts with coverage config**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      enabled: true,
      reporter: ['text', 'html', 'lcov'],
      include: ['src/components/**/*.tsx'],
      thresholds: {
        statements: 75,
        branches: 75,
        functions: 75,
        lines: 75,
      },
    },
  },
});
```

- [ ] **Step 3: Run client tests to verify the config doesn't break anything**

Run: `cd client; npm test`
Expected: All 5 existing tests pass, coverage report shows ~22.7% (5/22 components)

- [ ] **Step 4: Commit**

```bash
git add client/vitest.config.ts client/package.json
git commit -m "feat(client): add vitest coverage config with 75% threshold"
```

---

### Task 2: LibraryView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/LibraryView.test.tsx`

- [ ] **Step 1: Create LibraryView.test.tsx**

```typescript
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
    mocks.smartFetch.mockReset();
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
      totalFiles: 1000,
      duplicates: 5,
      upgradeable: 10,
      totalSize: 5000000000,
      FFMPEG_AVAILABLE: true,
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
      totalFiles: 100,
      duplicates: 0,
      upgradeable: 0,
      totalSize: 0,
      FFMPEG_AVAILABLE: false,
    }));

    render(<LibraryView />);

    await waitFor(() => {
      expect(screen.getByText(/FFmpeg Not Found/i)).toBeInTheDocument();
    });
  });

  it('switches tabs and loads tab data', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({
      totalFiles: 500, duplicates: 2, upgradeable: 3, totalSize: 1000,
    }));

    render(<LibraryView />);

    await waitFor(() => expect(screen.getByText('500')).toBeInTheDocument());

    fireEvent.click(screen.getByText('tab_duplicates'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/duplicates');

    fireEvent.click(screen.getByText('tab_upgradeable'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/upgradeable');

    fireEvent.click(screen.getByText(/Metadata Issues/));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/missing-metadata');
  });

  it('starts a library scan', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({
      totalFiles: 0, duplicates: 0, upgradeable: 0, totalSize: 0,
    }));

    render(<LibraryView />);

    await waitFor(() => expect(screen.getByText('action_scan')).toBeInTheDocument());
    fireEvent.click(screen.getByText('action_scan'));

    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/library/scan', expect.objectContaining({ method: 'POST' }));
    });
    expect(mocks.showToast).toHaveBeenCalledWith('Scan started', 'success');
  });

  it('listens to socket scan events', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({ totalFiles: 0, duplicates: 0, upgradeable: 0, totalSize: 0 }));
    render(<LibraryView />);

    await waitFor(() => {
      expect(mocks.socket.on).toHaveBeenCalledWith('scan:progress', expect.any(Function));
      expect(mocks.socket.on).toHaveBeenCalledWith('scan:complete', expect.any(Function));
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/LibraryView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/LibraryView.test.tsx
git commit -m "test(client): add LibraryView component tests"
```

---

### Task 3: SearchView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/SearchView.test.tsx`

- [ ] **Step 1: Create SearchView.test.tsx**

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

function mockResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

describe('SearchView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.searchState.query = '';
    mocks.searchState.type = 'albums';
    mocks.searchState.results = [];
    mocks.searchState.total = 0;
    mocks.searchState.page = 0;
    mocks.smartFetch.mockReset();
  });

  it('shows start searching empty state', () => {
    render(<SearchView />);
    expect(screen.getByText('msg_start_searching')).toBeInTheDocument();
    expect(screen.getByText('msg_enter_keywords')).toBeInTheDocument();
  });

  it('shows no results empty state after search', () => {
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

  it('changes search type', () => {
    render(<SearchView />);
    fireEvent.click(screen.getByText('Artists'));
    expect(mocks.setSearchState).toHaveBeenCalledWith(expect.any(Function));
  });

  it('renders search input with placeholder', () => {
    render(<SearchView />);
    const input = screen.getByPlaceholderText('common_search_placeholder');
    expect(input).toBeInTheDocument();
  });

  it('renders results in list view', () => {
    mocks.searchState.query = 'test';
    mocks.searchState.results = [
      { id: '1', title: 'Album One', artist: { name: 'Artist A' }, image: {} },
      { id: '2', title: 'Album Two', artist: { name: 'Artist B' }, image: {} },
    ];
    mocks.searchState.total = 2;
    render(<SearchView />);
    expect(screen.getByText('Album One')).toBeInTheDocument();
    expect(screen.getByText('Artist A')).toBeInTheDocument();
  });

  it('toggles hi-res filter for non-artist types', () => {
    render(<SearchView />);
    const hiresBtn = screen.getByText('label_hires_only');
    fireEvent.click(hiresBtn);
    fireEvent.click(hiresBtn); // toggle off
  });

  it('shows pagination when total > limit', () => {
    mocks.searchState.query = 'test';
    mocks.searchState.total = 50;
    mocks.searchState.results = Array.from({ length: 20 }, (_, i) => ({
      id: String(i), title: `Track ${i}`, image: {},
    }));
    render(<SearchView />);
    expect(screen.getByText('label_page')).toBeInTheDocument();
    expect(screen.getByText('label_next')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/SearchView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/SearchView.test.tsx
git commit -m "test(client): add SearchView component tests"
```

---

### Task 4: AnalyticsView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/AnalyticsView.test.tsx`

- [ ] **Step 1: Create AnalyticsView.test.tsx**

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnalyticsView } from '../AnalyticsView';

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
    mocks.smartFetch.mockReset();
  });

  it('shows loading skeleton while fetching', () => {
    mocks.smartFetch.mockReturnValue(new Promise(() => {}));
    render(<AnalyticsView />);
    expect(document.querySelector('.skeleton')).toBeInTheDocument();
  });

  it('shows empty state when no data', async () => {
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
      expect(screen.getByText('Artist Two')).toBeInTheDocument();
      expect(screen.getByText('50 tracks')).toBeInTheDocument();
    });
  });

  it('renders quality distribution bars', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(analyticsData));
    render(<AnalyticsView />);

    await waitFor(() => {
      expect(screen.getByText(/20%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
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
      expect(screen.getByText('Consider upgrading FLAC files')).toBeInTheDocument();
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
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/AnalyticsView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/AnalyticsView.test.tsx
git commit -m "test(client): add AnalyticsView component tests"
```

---

### Task 5: QueueView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/QueueView.test.tsx`

- [ ] **Step 1: Create QueueView.test.tsx**

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueueView } from '../QueueView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  fetchQueue: vi.fn(),
  setStats: vi.fn(),
  updateItemProgress: vi.fn(),
  socket: { on: vi.fn(), off: vi.fn() },
  connected: true,
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

const defaultStats = { total: 0, downloading: 0, completed: 0, failed: 0, pending: 0 };

vi.mock('../../stores/queueStore', () => ({
  useQueueStore: (selector?: (state: any) => any) => {
    const state = {
      stats: mocks.stats || defaultStats,
      queue: mocks.queue || [],
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
    mocks.stats = { ...defaultStats };
    mocks.queue = [];
    mocks.smartFetch.mockReset();
    mocks.fetchQueue.mockReset();
    mocks.socket.on.mockReset();
    mocks.socket.off.mockReset();
    mocks.connected = true;
  });

  it('shows empty state when queue is empty', () => {
    render(<QueueView />);
    expect(screen.getByText('msg_queue_empty')).toBeInTheDocument();
    expect(screen.getByText('msg_add_urls')).toBeInTheDocument();
  });

  it('renders stats cards with default zeros', () => {
    render(<QueueView />);
    const stats = screen.getAllByText('0');
    expect(stats.length).toBeGreaterThanOrEqual(4);
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
      method: 'POST',
      body: JSON.stringify({ action: 'pause' }),
    }));
  });

  it('sends resume action', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({}));
    render(<QueueView />);
    fireEvent.click(screen.getByText('action_resume'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/action', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'resume' }),
    }));
  });

  it('sends clear action', () => {
    mocks.smartFetch.mockResolvedValue(mockResponse({}));
    render(<QueueView />);
    fireEvent.click(screen.getByText('action_clear'));
    expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/action', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ action: 'clear' }),
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
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/QueueView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/QueueView.test.tsx
git commit -m "test(client): add QueueView component tests"
```

---

### Task 6: ArtistDetailView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/ArtistDetailView.test.tsx`

- [ ] **Step 1: Create ArtistDetailView.test.tsx**

```typescript
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
  biography: { en: 'A test artist biography that is long enough to test read more functionality. '.repeat(20) },
  tracks: {
    items: [
      { id: 't1', title: 'Track One', duration: 240, track_number: 1, performer: { name: 'Test Artist' } },
      { id: 't2', title: 'Track Two', duration: 180, track_number: 2, performer: { name: 'Test Artist' } },
    ],
  },
  albums: {
    items: [
      { id: 'a1', title: 'Album One', image: { small: '' }, release_date_original: '2024-01-15' },
    ],
  },
  similar_artists: {
    items: [
      { id: 'sa1', name: 'Similar Artist', image: { small: '' } },
    ],
  },
};

describe('ArtistDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.navData = { id: '123' };
    mocks.smartFetch.mockReset();
  });

  it('shows no artist selected when no navData.id', () => {
    mocks.navData = null;
    render(<ArtistDetailView />);
    expect(screen.getByText('No artist selected')).toBeInTheDocument();
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

  it('shows read more for long biography', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);

    await waitFor(() => {
      expect(screen.getByText(/Read more/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Read more/));
    expect(screen.getByText(/Read less/)).toBeInTheDocument();
  });

  it('fetches artist data on mount with navData.id', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(artistData));
    render(<ArtistDetailView />);

    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/artist/123?limit=20');
    });
  });
});
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/ArtistDetailView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/ArtistDetailView.test.tsx
git commit -m "test(client): add ArtistDetailView component tests"
```

---

### Task 7: AlbumDetailView.test.tsx

**Files:**
- Create: `client/src/components/__tests__/AlbumDetailView.test.tsx`

- [ ] **Step 1: Create AlbumDetailView.test.tsx**

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlbumDetailView } from '../AlbumDetailView';

const mocks = vi.hoisted(() => ({
  smartFetch: vi.fn(),
  showToast: vi.fn(),
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
  image: { large: 'https://example.com/large.jpg', medium: 'https://example.com/med.jpg', small: 'https://example.com/small.jpg' },
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
    mocks.smartFetch.mockReset();
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
      expect(screen.getByText(/Download Album/)).toBeInTheDocument();
    });
  });

  it('opens download modal with ZIP and separate options', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Download Album/));
    });

    expect(screen.getByText('Download as ZIP')).toBeInTheDocument();
    expect(screen.getByText('Separate Files')).toBeInTheDocument();
  });

  it('cancels modal', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Download Album/));
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Download as ZIP')).not.toBeInTheDocument();
  });

  it('queues album download as separate files', async () => {
    mocks.smartFetch.mockResolvedValue(mockResponse(albumData));
    render(<AlbumDetailView />);

    await waitFor(() => {
      fireEvent.click(screen.getByText(/Download Album/));
    });

    mocks.smartFetch.mockResolvedValue(mockResponse({ success: true }));
    fireEvent.click(screen.getByText('Separate Files'));

    await waitFor(() => {
      expect(mocks.smartFetch).toHaveBeenCalledWith('/api/queue/add', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ type: 'album', id: 'a1' }),
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
```

- [ ] **Step 2: Run the test**

Run: `cd client; npx vitest run src/components/__tests__/AlbumDetailView.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add client/src/components/__tests__/AlbumDetailView.test.tsx
git commit -m "test(client): add AlbumDetailView component tests"
```

---

### Task 8: Run all client tests + verify coverage

- [ ] **Step 1: Run all client tests**

Run: `cd client; npx vitest run`

Expected: All 11 test files pass (5 original + 6 new). Verify coverage report shows >=75% for components.

If coverage is under 75%, add more assertions to the new tests or add tests for smaller components.

- [ ] **Step 2: Run root tests to ensure nothing broke**

Run: `npm test`
Expected: All 193 root tests pass

---

### Task 9: CI caching for better-sqlite3

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `.github/workflows/desktop-release.yml`

- [ ] **Step 1: Add caching step to test.yml after `npm ci`**

Add after the "Install dependencies" step:

```yaml
    - name: Cache better-sqlite3 build
      uses: actions/cache@v4
      with:
        path: node_modules/better-sqlite3/build/
        key: better-sqlite3-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          better-sqlite3-${{ runner.os }}-
```

- [ ] **Step 2: Add cache step to desktop-release.yml**

Add after the "Install dependencies" step (line 30):

```yaml
    - name: Cache better-sqlite3 build
      uses: actions/cache@v4
      with:
        path: node_modules/better-sqlite3/build/
        key: better-sqlite3-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
        restore-keys: |
          better-sqlite3-${{ runner.os }}-
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/test.yml .github/workflows/desktop-release.yml
git commit -m "ci: cache better-sqlite3 build artifacts across jobs"
```

---

### Task 10: Electron smoke test

**Files:**
- Modify: `package.json` (root) — add `playwright` devDependency, add `test:smoke` script
- Create: `tests/electron-smoke.test.ts`
- Modify: `.github/workflows/test.yml` — add smoke test step (Windows + push to main only)

- [ ] **Step 1: Add playwright dependency and test:smoke script**

```jsonc
// package.json root — add to devDependencies:
"playwright": "^1.52.0",

// add to scripts:
"test:smoke": "npx vitest run --config vitest.config.smoke.mjs",
```

- [ ] **Step 2: Create `vitest.config.smoke.mjs` in root**

```javascript
export default {
  test: {
    environment: 'node',
    include: ['tests/**/*.smoke.test.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
  },
};
```

- [ ] **Step 3: Create `tests/electron-smoke.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import http from 'http';
import { setTimeout as sleep } from 'timers/promises';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ELECTRON_BIN = path.join(PROJECT_ROOT, 'node_modules', '.bin', 'electron');

describe('Electron smoke test', () => {
  it('app starts, dashboard loads, /api/status responds', async () => {
    // Build backend first
    const buildProc = spawn('npx', ['tsc', '-b'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true,
    });
    await new Promise<void>((resolve, reject) => {
      buildProc.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Build failed with code ${code}`));
      });
    });

    // Start Electron app
    const electron = spawn(ELECTRON_BIN, ['.'], {
      cwd: PROJECT_ROOT,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        DASHBOARD_PORT: '0', // Let OS pick port
      },
    });

    let output = '';
    let dashboardUrl = '';

    const readOutput = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for app')), 30000);

      electron.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
        const match = output.match(/http:\/\/localhost:(\d+)/);
        if (match) {
          dashboardUrl = `http://localhost:${match[1]}`;
        }
      });

      electron.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
        const match = output.match(/http:\/\/localhost:(\d+)/);
        if (match) {
          dashboardUrl = `http://localhost:${match[1]}`;
        }
      });

      // Wait for dashboard URL or specific output
      const check = async () => {
        if (dashboardUrl) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        if (output.includes('ready') || output.includes('started') || output.includes('listening')) {
          clearTimeout(timeout);
          resolve();
          return;
        }
        setTimeout(check, 500);
      };
      check();
    });

    try {
      await readOutput;

      // Find port if not found from output — try default port
      dashboardUrl = dashboardUrl || 'http://localhost:3210';

      // Wait for server to be ready
      for (let i = 0; i < 10; i++) {
        try {
          await fetch(`${dashboardUrl}/api/status`);
          break;
        } catch {
          await sleep(1000);
        }
      }

      // Check /api/status
      const statusRes = await fetch(`${dashboardUrl}/api/status`);
      expect(statusRes.ok).toBe(true);
      const statusData = await statusRes.json();
      expect(statusData).toHaveProperty('status');
    } finally {
      // Cleanup
      electron.kill('SIGTERM');
      // Force kill after 3 seconds
      setTimeout(() => {
        try { electron.kill('SIGKILL'); } catch {}
      }, 3000);
    }
  }, 60000);
});
```

- [ ] **Step 4: Add smoke test step to test.yml (Windows + push-to-main only)**

Add after the "Run client tests" step:

```yaml
    - name: Electron Smoke Test
      if: runner.os == 'Windows' && github.event_name == 'push' && github.ref == 'refs/heads/main'
      run: npm run test:smoke
```

- [ ] **Step 5: Install playwright browsers**

```bash
npx playwright install chromium
```

- [ ] **Step 6: Commit**

```bash
git add package.json vitest.config.smoke.mjs tests/electron-smoke.test.ts .github/workflows/test.yml
git commit -m "test: add Electron smoke test with playwright (Windows + main only)"
```

---

### Task 11: Final verification + push

- [ ] **Step 1: Run all root tests**

Run: `npm test`
Expected: 193+ tests PASS

- [ ] **Step 2: Run tsc --noEmit**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: zero warnings

- [ ] **Step 4: Push all commits**

```bash
git push origin main
```
