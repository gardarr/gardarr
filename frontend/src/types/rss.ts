// Types for communication with the API v1 RSS endpoints. Gardarr manages
// qBittorrent's own RSS feeds and auto-downloading rules - it never polls
// feeds or evaluates rules itself, that stays entirely on qBittorrent's side.

export interface RSSArticle {
  id: string;
  title: string;
  summary?: string;
  link?: string;
  is_read: boolean;
}

export interface RSSFeed {
  path: string;
  url?: string;
  title: string;
  last_build?: string;
  is_loading: boolean;
  has_error: boolean;
  articles?: RSSArticle[];
  worker_id?: string;
}

export interface RSSRule {
  name: string;
  enabled: boolean;
  must_contain: string;
  must_not_contain: string;
  use_regex: boolean;
  episode_filter?: string;
  smart_filter: boolean;
  previously_matched_episodes?: string[];
  affected_feeds?: string[];
  ignore_days: number;
  last_match?: string;
  add_paused: boolean;
  assigned_category?: string;
  save_path?: string;
  torrent_content_layout?: string;
  worker_id?: string;
}

export interface RSSAddFeedRequest {
  url: string;
  path?: string;
}

export interface RSSSetFeedURLRequest {
  path: string;
  url: string;
}

export interface RSSAddFolderRequest {
  path: string;
}

export interface RSSMoveItemRequest {
  item_path: string;
  dest_path: string;
}

export interface RSSMarkAsReadRequest {
  item_path: string;
  article_id?: string;
}

export interface RSSSetRuleRequest {
  enabled: boolean;
  must_contain: string;
  must_not_contain: string;
  use_regex: boolean;
  episode_filter?: string;
  smart_filter: boolean;
  affected_feeds: string[];
  ignore_days: number;
  add_paused: boolean;
  assigned_category?: string;
  save_path?: string;
  torrent_content_layout?: string;
}

// Per-worker errors keyed by worker UUID, same convention as the
// aggregated tasks endpoints.
export type RSSWorkerErrors = Record<string, string>;

export interface RSSFeedListResponse {
  feeds: RSSFeed[];
  errors: RSSWorkerErrors;
}

export interface RSSRuleListResponse {
  rules: RSSRule[];
  errors: RSSWorkerErrors;
}

// Matching articles preview: feed name/URL -> matching article titles.
export type RSSMatchingArticles = Record<string, string[]>;
