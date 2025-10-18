import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Task,
  CreateTaskRequest
} from '../types/torrent';

/**
 * Serviço para comunicação com a API v1/tasks do backend
 */
export class TorrentService {
  private readonly baseEndpoint = '/agents/tasks';

  /**
   * Lista todos os torrents/tasks
   */
  async listTasks(): Promise<ApiResponse<Task[]>> {
    return api.get<Task[]>(this.baseEndpoint);
  }

  /**
   * Cria uma nova task/torrent para um agente específico
   */
  async createTask(agentId: string, taskData: CreateTaskRequest): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task`, taskData);
  }

  /**
   * Remove uma task/torrent
   */
  async deleteTask(taskId: string, purge: boolean = false): Promise<ApiResponse<null>> {
    const endpoint = `${this.baseEndpoint}/${taskId}${purge ? '?purge=true' : ''}`;
    return api.delete<null>(endpoint);
  }

  /**
   * Pausa uma task/torrent
   */
  async pauseTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/tasks/${taskId}/pause`);
  }

  /**
   * Retoma uma task/torrent
   */
  async resumeTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/tasks/${taskId}/resume`);
  }

  /**
   * Força download de uma task/torrent
   */
  async forceDownloadTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/tasks/${taskId}/force_download`);
  }
}

// Instância padrão do serviço
export const torrentService = new TorrentService();
