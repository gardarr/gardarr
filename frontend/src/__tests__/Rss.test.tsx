import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../i18n';
import Rss from '../Rss';
import type { RSSFeed, RSSRule } from '../types/rss';
import type { Worker } from '../types/worker';

vi.mock('../services/rss', () => ({
  rssService: {
    listAllFeeds: vi.fn(),
    listAllRules: vi.fn(),
    addFeed: vi.fn(),
    removeFeed: vi.fn(),
    refreshItem: vi.fn(),
    setRule: vi.fn(),
    removeRule: vi.fn(),
    matchingArticles: vi.fn(),
  },
}));

vi.mock('../services/workers', () => ({
  workerService: {
    listWorkersBasic: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

import { rssService } from '../services/rss';
import { workerService } from '../services/workers';

const worker: Worker = {
  uuid: 'worker-1',
  name: 'Main qBittorrent',
  address: 'http://localhost:8080',
  status: 'active',
  instance: {} as Worker['instance'],
};

const feed: RSSFeed = {
  path: 'Movies\\1080p',
  url: 'https://example.com/feed.rss',
  title: '1080p Releases',
  is_loading: false,
  has_error: false,
  worker_id: 'worker-1',
};

const rule: RSSRule = {
  name: 'my-rule',
  enabled: true,
  must_contain: '1080p',
  must_not_contain: 'CAM',
  use_regex: false,
  smart_filter: false,
  affected_feeds: ['https://example.com/feed.rss'],
  ignore_days: 0,
  add_paused: false,
  worker_id: 'worker-1',
};

describe('Rss page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(workerService.listWorkersBasic).mockResolvedValue({ data: [worker] });
  });

  it('shows an empty state when there are no feeds or rules', async () => {
    vi.mocked(rssService.listAllFeeds).mockResolvedValue({ data: { feeds: [], errors: {} } });
    vi.mocked(rssService.listAllRules).mockResolvedValue({ data: { rules: [], errors: {} } });

    render(<Rss />);

    await waitFor(() => {
      expect(screen.getByText('No feeds found')).toBeInTheDocument();
    });
  });

  it('renders feeds and rules tagged with their worker name', async () => {
    vi.mocked(rssService.listAllFeeds).mockResolvedValue({ data: { feeds: [feed], errors: {} } });
    vi.mocked(rssService.listAllRules).mockResolvedValue({ data: { rules: [rule], errors: {} } });

    render(<Rss />);

    await waitFor(() => {
      expect(screen.getByText('1080p Releases')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Main qBittorrent').length).toBeGreaterThan(0);
  });

  it('surfaces a per-worker error banner when a worker fails to respond', async () => {
    vi.mocked(rssService.listAllFeeds).mockResolvedValue({
      data: { feeds: [], errors: { 'worker-1': 'connection refused' } },
    });
    vi.mocked(rssService.listAllRules).mockResolvedValue({ data: { rules: [], errors: {} } });

    render(<Rss />);

    await waitFor(() => {
      expect(screen.getByText(/connection refused/)).toBeInTheDocument();
    });
  });
});
