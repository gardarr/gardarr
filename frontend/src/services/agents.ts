import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Agent,
  CreateAgentRequest,
  UpdateAgentRequest
} from '../types/agent';

/**
 * Service for communication with the API v1/agents from the backend
 */
export class AgentService {
  private readonly baseEndpoint = '/agents';

  /**
   * Lists all agents
   */
  async listAgents(): Promise<ApiResponse<Agent[]>> {
    return api.get<Agent[]>(this.baseEndpoint);
  }

  /**
   * Gets a specific agent by ID
   */
  async getAgent(agentId: string): Promise<ApiResponse<Agent>> {
    return api.get<Agent>(`/agent/${agentId}`);
  }

  /**
   * Creates a new agent
   */
  async createAgent(agentData: CreateAgentRequest): Promise<ApiResponse<Agent>> {
    return api.post<Agent>(this.baseEndpoint, agentData);
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
  async listAgentsTasks(): Promise<ApiResponse<any[]>> {
    return api.get<any[]>(`${this.baseEndpoint}/tasks`);
  }

  /**
   * Lists tasks for a specific agent
   */
  async listAgentTasks(agentId: string): Promise<ApiResponse<any[]>> {
    return api.get<any[]>(`/agent/${agentId}/tasks`);
  }

  /**
   * Creates a task for a specific agent
   */
  async createAgentTask(agentId: string, taskData: any): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task`, taskData);
  }
}

// Default service instance
export const agentService = new AgentService();
