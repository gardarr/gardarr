import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  RSSFeed,
  RSSRule,
  RSSAddFeedRequest,
  RSSSetFeedURLRequest,
  RSSAddFolderRequest,
  RSSMoveItemRequest,
  RSSMarkAsReadRequest,
  RSSSetRuleRequest,
  RSSFeedListResponse,
  RSSRuleListResponse,
  RSSMatchingArticles,
} from '../types/rss';

/**
 * Service for communication with the API v1 RSS endpoints. Gardarr manages
 * qBittorrent's own RSS engine (feeds + auto-downloading rules) through
 * each worker's WebUI API - it never polls feeds or evaluates rules itself.
 */
export class RSSService {
  /**
   * Aggregates feeds across every registered worker, each tagged with its
   * worker_id
   */
  async listAllFeeds(): Promise<ApiResponse<RSSFeedListResponse>> {
    return api.get<RSSFeedListResponse>('/workers/rss/feeds');
  }

  /**
   * Aggregates auto-downloading rules across every registered worker, each
   * tagged with its worker_id
   */
  async listAllRules(): Promise<ApiResponse<RSSRuleListResponse>> {
    return api.get<RSSRuleListResponse>('/workers/rss/rules');
  }

  async listFeeds(workerId: string, withData = false): Promise<ApiResponse<RSSFeed[]>> {
    return api.get<RSSFeed[]>(`/worker/${workerId}/rss/feeds${withData ? '?with_data=true' : ''}`);
  }

  async addFeed(workerId: string, data: RSSAddFeedRequest): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/feeds`, data);
  }

  async removeFeed(workerId: string, path: string): Promise<ApiResponse<void>> {
    const params = new URLSearchParams({ path });
    return api.delete(`/worker/${workerId}/rss/feeds?${params.toString()}`);
  }

  /** Requires qBittorrent 4.6.0+ (WebAPI v2.9.1+) */
  async setFeedURL(workerId: string, data: RSSSetFeedURLRequest): Promise<ApiResponse<{ message: string }>> {
    return api.put(`/worker/${workerId}/rss/feeds/url`, data);
  }

  async addFolder(workerId: string, data: RSSAddFolderRequest): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/folders`, data);
  }

  /** Moves or renames a feed/folder - qBittorrent uses the same endpoint for both */
  async moveItem(workerId: string, data: RSSMoveItemRequest): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/items/move`, data);
  }

  /** Forces an immediate refresh instead of waiting for qBittorrent's own poll interval */
  async refreshItem(workerId: string, itemPath: string): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/items/refresh`, { item_path: itemPath });
  }

  async markAsRead(workerId: string, data: RSSMarkAsReadRequest): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/items/mark_read`, data);
  }

  async listRules(workerId: string): Promise<ApiResponse<RSSRule[]>> {
    return api.get<RSSRule[]>(`/worker/${workerId}/rss/rules`);
  }

  /** Creates or updates a rule - qBittorrent's API doesn't distinguish the two */
  async setRule(workerId: string, ruleName: string, data: RSSSetRuleRequest): Promise<ApiResponse<{ message: string }>> {
    return api.put(`/worker/${workerId}/rss/rules/${encodeURIComponent(ruleName)}`, data);
  }

  async renameRule(workerId: string, ruleName: string, newRuleName: string): Promise<ApiResponse<{ message: string }>> {
    return api.post(`/worker/${workerId}/rss/rules/${encodeURIComponent(ruleName)}/rename`, { new_rule_name: newRuleName });
  }

  async removeRule(workerId: string, ruleName: string): Promise<ApiResponse<void>> {
    return api.delete(`/worker/${workerId}/rss/rules/${encodeURIComponent(ruleName)}`);
  }

  /** Previews which currently-known articles a rule would match, grouped by feed */
  async matchingArticles(workerId: string, ruleName: string): Promise<ApiResponse<RSSMatchingArticles>> {
    return api.get<RSSMatchingArticles>(`/worker/${workerId}/rss/rules/${encodeURIComponent(ruleName)}/matching_articles`);
  }
}

// Default service instance
export const rssService = new RSSService();
