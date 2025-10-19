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
  async deleteTask(agentId: string, taskId: string, purge: boolean = false): Promise<ApiResponse<null>> {
    const endpoint = `/agent/${agentId}/task/${taskId}${purge ? '?purge=true' : ''}`;
    return api.delete<null>(endpoint);
  }

  /**
   * Pausa uma task/torrent (stop)
   */
  async pauseTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/stop`);
  }

  /**
   * Retoma uma task/torrent (start)
   */
  async resumeTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/start`);
  }

  /**
   * Força download de uma task/torrent
   */
  async forceDownloadTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/force_download`);
  }

  /**
   * Força reannounce de uma task/torrent
   */
  async forceReannounceTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/force_reannounce`);
  }

  /**
   * Força recheck de uma task/torrent
   */
  async forceRecheckTask(agentId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/force_recheck`);
  }

  /**
   * Ativa/desativa super seeding de uma task/torrent
   */
  async toggleSuperSeeding(agentId: string, taskId: string, enabled: boolean): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/super_seeding`, { enabled });
  }

  /**
   * Renomeia uma task/torrent
   */
  async renameTask(agentId: string, taskId: string, newName: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/rename`, { new_name: newName });
  }

  /**
   * Altera o caminho (location) de uma task/torrent
   */
  async setTaskLocation(agentId: string, taskId: string, location: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/location`, { location });
  }
}

// Instância padrão do serviço
export const torrentService = new TorrentService();
