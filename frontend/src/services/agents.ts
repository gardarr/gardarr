import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest,
  Version,
  TaskStats,
  AgentPreferences,
  SpeedLimitsSchema,
  ActiveLimitsSchema,
  LogEntry
} from '../types/agent';

/**
 * Service for communication with the API v1/agents from the backend
 */
export class AgentService {
  private readonly baseEndpoint = '/agents/';

  /**
   * Lists all agents
   */
  async listAgents(): Promise<ApiResponse<Agent[]>> {
    return api.get<Agent[]>(`/agents/`);
  }

  /**
   * Gets a specific agent by ID
   */
  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return api.get<Agent>(`/agent/${agentId}/`);
  }

  /**
   * Creates a new agent
   */
  async createAgent(agentData: CreateAgentRequest): Promise<ApiResponse<Agent>> {
    return api.post<Agent>('/agent', agentData);
  }

  /**
   * Updates an existing agent
   */
  async updateAgent(agentId: string, agentData: UpdateAgentRequest): Promise<ApiResponse<Agent>> {
    return api.put<Agent>(`/agent/${agentId}`, agentData);
  }

  /**
   * Deletes an agent
   */
  async deleteAgent(agentId: string): Promise<ApiResponse<null>> {
    return api.delete<null>(`/agent/${agentId}`);
  }

  /**
   * Lists all tasks from all agents
   */
  async listAgentsTasks(): Promise<ApiResponse<unknown[]>> {
    return api.get<unknown[]>(`${this.baseEndpoint}/tasks/`);
  }

  /**
   * Lists tasks for a specific agent
   */
  async listAgentTasks(agentId: string): Promise<ApiResponse<unknown[]>> {
    return api.get<unknown[]>(`/agent/${agentId}/tasks/`);
  }

  /**
   * Creates a task for a specific agent
   */
  async createAgentTask(agentId: string, taskData: unknown): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task`, taskData);
  }

  /**
   * Gets the version information for a specific agent
   */
  async getAgentVersion(agentId: string): Promise<ApiResponse<Version>> {
    return api.get<Version>(`/agent/${agentId}/version/`);
  }

  /**
   * Gets the task statistics for a specific agent
   */
  async getAgentTaskStats(agentId: string): Promise<ApiResponse<TaskStats>> {
    return api.get<TaskStats>(`/agent/${agentId}/tasks/stats/`);
  }

  /**
   * Gets the preferences for a specific agent
   */
  async getAgentPreferences(agentId: string): Promise<ApiResponse<AgentPreferences>> {
    return api.get<AgentPreferences>(`/agent/${agentId}/preferences`);
  }

  /**
   * Sets the speed limits for a specific agent
   */
  async setAgentSpeedLimits(agentId: string, limits: SpeedLimitsSchema): Promise<ApiResponse<{ message: string }>> {
    return api.post<{ message: string }>(`/agent/${agentId}/speed/limits`, limits);
  }

  /**
   * Sets the active torrent limits for a specific agent
   */
  async setAgentActiveLimits(agentId: string, limits: ActiveLimitsSchema): Promise<ApiResponse<{ message: string }>> {
    return api.post<{ message: string }>(`/agent/${agentId}/active/limits`, limits);
  }

  /**
   * Get agent logs
   */
  async getAgentLogs(
    agentId: string,
    options: {
      normal?: boolean;
      info?: boolean;
      warning?: boolean;
      critical?: boolean;
      lastKnownId?: number;
    } = {}
  ): Promise<ApiResponse<LogEntry[]>> {
    const params = new URLSearchParams();
    if (options.normal !== undefined) params.append('normal', options.normal.toString());
    if (options.info !== undefined) params.append('info', options.info.toString());
    if (options.warning !== undefined) params.append('warning', options.warning.toString());
    if (options.critical !== undefined) params.append('critical', options.critical.toString());
    if (options.lastKnownId !== undefined) params.append('last_known_id', options.lastKnownId.toString());

    return api.get<LogEntry[]>(`/agent/${agentId}/logs?${params.toString()}`);
  }
}

// Default service instance
export const agentService = new AgentService();
