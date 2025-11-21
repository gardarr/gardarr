import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Task,
  CreateTaskRequest,
  TaskMagnetLink,
  TaskFile,
  TaskLimits,
  TaskListResponse
} from '../types/torrent';

/**
 * Serviço para comunicação com a API v1/tasks do backend
 */
export class TorrentService {
  private readonly baseEndpoint = '/agents/tasks';

  /**
   * Lista todos os torrents/tasks
   */
  async listTasks(): Promise<ApiResponse<TaskListResponse>> {
    return api.get<TaskListResponse>(this.baseEndpoint);
  }

  /**
   * Lista tasks de um agente específico
   */
  async listAgentTasks(agentId: string): Promise<ApiResponse<Task[]>> {
    return api.get<Task[]>(`/agent/${agentId}/tasks`);
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

  /**
   * Lista os arquivos de uma task/torrent específica
   */
  async listTaskFiles(agentId: string, taskId: string): Promise<ApiResponse<TaskFile[]>> {
    return api.get<TaskFile[]>(`/agent/${agentId}/task/${taskId}/files`);
  }

  /**
   * Atualiza as tags de uma task/torrent
   */
  async updateTaskTags(agentId: string, taskId: string, tags: string[]): Promise<ApiResponse<null>> {
    return api.put<null>(`/agent/${agentId}/task/${taskId}/tags`, { tags });
  }

  /**
   * Atualiza a categoria de uma task/torrent
   */
  async updateTaskCategory(agentId: string, taskId: string, category: string): Promise<ApiResponse<null>> {
    return api.put<null>(`/agent/${agentId}/task/${taskId}/category`, { category });
  }

  /**
   * Obtém os limites de uma task/torrent específica
   */
  async getTaskLimits(agentId: string, taskId: string): Promise<ApiResponse<TaskLimits>> {
    return api.get<TaskLimits>(`/agent/${agentId}/task/${taskId}/limits`);
  }

  /**
   * Define o limite de download de uma task/torrent
   */
  async setTaskDownloadLimit(agentId: string, taskId: string, limit: number): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/limit_download_rate`, { limit });
  }

  /**
   * Define o limite de upload de uma task/torrent
   */
  async setTaskUploadLimit(agentId: string, taskId: string, limit: number): Promise<ApiResponse<null>> {
    return api.post<null>(`/agent/${agentId}/task/${taskId}/limit_upload_rate`, { limit });
  }

  /**
   * Define o limite de compartilhamento (share limit) de uma task/torrent
   */
  async setTaskShareLimit(
    agentId: string,
    taskId: string,
    ratioLimit: number,
    seedingTimeLimit: number,
    inactiveSeedingTimeLimit: number
  ): Promise<ApiResponse<null>> {
    return api.put<null>(`/agent/${agentId}/task/${taskId}/share_limit`, {
      ratio_limit: ratioLimit,
      seeding_time_limit: seedingTimeLimit,
      inactive_seeding_time_limit: inactiveSeedingTimeLimit
    });
  }
}

// Instância padrão do serviço
export const torrentService = new TorrentService();

/**
 * Converte um magnet URI para TaskMagnetLink
 * @param magnetUri - O magnet URI a ser convertido
 * @returns TaskMagnetLink ou null se o URI for inválido
 */
export function convertMagnetUriToTaskMagnetLink(magnetUri: string): TaskMagnetLink | null {
  try {
    const url = new URL(magnetUri);

    if (url.protocol !== 'magnet:') {
      return null;
    }

    // Extrai o hash do torrent (xt parameter)
    const xtMatch = url.searchParams.get('xt')?.match(/urn:btih:([a-fA-F0-9]{40})/);
    const hash = xtMatch ? xtMatch[1] : '';

    // Extrai o nome do torrent (dn parameter)
    const displayName = url.searchParams.get('dn') || '';

    // Extrai os trackers (tr parameters)
    const trackers: string[] = [];
    url.searchParams.forEach((value, key) => {
      if (key === 'tr') {
        trackers.push(value);
      }
    });

    // Extrai o tamanho exato (xl parameter)
    const exactLength = url.searchParams.get('xl') || '';

    // Extrai a fonte exata (xs parameter)
    const exactSource = url.searchParams.get('xs') || '';

    return {
      hash,
      display_name: displayName,
      trackers,
      exact_length: exactLength,
      exact_source: exactSource
    };
  } catch (error) {
    console.error('Error parsing magnet URI:', error);
    return null;
  }
}
