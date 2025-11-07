import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';

export interface WindowedRequest {
  agentId: string;
  from: string; // RFC3339
  to?: string; // RFC3339
  step?: string; // e.g., '5m'
  groupBy?: 'agent' | 'task';
  taskHash?: string;
}

export interface WindowedResponse<T = unknown> {
  agent_id: string;
  from: string;
  to: string;
  step: string;
  group_by: string;
  windows: T[] | Record<string, unknown>;
}

export interface UploadDiffResult {
  first_ul_bytes: number;
  last_ul_bytes: number;
  diff: number;
  window: string;
  task: string;
}

export interface UploadDiffsResponse {
  agent_id: string;
  from: string;
  to: string;
  step: string;
  limit: number;
  results: UploadDiffResult[];
}

export interface TaskWindowedRequest {
  agentId: string;
  taskHash: string | string[]; // Single hash or array of hashes
  from: string; // RFC3339
  to?: string; // RFC3339
  step?: string; // e.g., '5m'
}

class StatisticsService {
  async getWindowed<T = unknown>(params: WindowedRequest): Promise<ApiResponse<WindowedResponse<T>>> {
    const { agentId, from, to, step = '5m', groupBy = 'agent', taskHash } = params;
    const query = new URLSearchParams();
    query.set('from', from);
    if (to) query.set('to', to);
    if (step) query.set('step', step);
    if (groupBy) query.set('group_by', groupBy);
    if (taskHash) query.set('task_hash', taskHash);
    return api.get<WindowedResponse<T>>(`/statistics/agents/${encodeURIComponent(agentId)}/range/windowed?${query.toString()}`);
  }

  /**
   * Get windowed metrics for specific task(s) (hash)
   * Filters statistics by task_hash (single or multiple comma-separated) and groups by task
   */
  async getWindowedByTask<T = unknown>(params: TaskWindowedRequest): Promise<ApiResponse<WindowedResponse<T>>> {
    const { agentId, taskHash, from, to, step = '5m' } = params;
    const query = new URLSearchParams();
    query.set('from', from);
    if (to) query.set('to', to);
    if (step) query.set('step', step);
    query.set('group_by', 'task');
    // Support single hash or multiple hashes (comma-separated)
    const hashString = Array.isArray(taskHash) ? taskHash.join(',') : taskHash;
    query.set('task_hash', hashString);
    return api.get<WindowedResponse<T>>(`/statistics/agents/${encodeURIComponent(agentId)}/range/windowed?${query.toString()}`);
  }

  async getUploadDiffs(params: { agentId: string; from: string; to?: string; step?: string; limit?: number }): Promise<ApiResponse<UploadDiffsResponse>> {
    const { agentId, from, to, step = '5m', limit = 10 } = params;
    const query = new URLSearchParams();
    query.set('from', from);
    if (to) query.set('to', to);
    if (step) query.set('step', step);
    if (limit) query.set('limit', limit.toString());
    return api.get<UploadDiffsResponse>(`/statistics/agents/${encodeURIComponent(agentId)}/upload-diffs?${query.toString()}`);
  }
}

export const statisticsService = new StatisticsService();


