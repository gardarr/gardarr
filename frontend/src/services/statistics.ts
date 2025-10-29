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
  windows: T[] | Record<string, any>;
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

class StatisticsService {
  async getWindowed<T = unknown>(params: WindowedRequest): Promise<ApiResponse<WindowedResponse<T>>> {
    const { agentId, from, to, step = '5m', groupBy = 'agent', taskHash } = params;
    const query = new URLSearchParams();
    query.set('from', from);
    if (to) query.set('to', to);
    if (step) query.set('step', step);
    if (groupBy) query.set('group_by', groupBy);
    if (taskHash) query.set('task_hash', taskHash);
    return api.get<WindowedResponse<T>>(`/statistics/agents/${agentId}/range/windowed?${query.toString()}`);
  }

  async getUploadDiffs(params: { agentId: string; from: string; to?: string; step?: string; limit?: number }): Promise<ApiResponse<UploadDiffsResponse>> {
    const { agentId, from, to, step = '5m', limit = 10 } = params;
    const query = new URLSearchParams();
    query.set('from', from);
    if (to) query.set('to', to);
    if (step) query.set('step', step);
    if (limit) query.set('limit', limit.toString());
    return api.get<UploadDiffsResponse>(`/statistics/agents/${agentId}/upload-diffs?${query.toString()}`);
  }
}

export const statisticsService = new StatisticsService();


