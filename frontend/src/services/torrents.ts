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
  private readonly baseEndpoint = '/workers/tasks';

  /**
   * Lista todos os torrents/tasks
   */
  async listTasks(): Promise<ApiResponse<TaskListResponse>> {
    return api.get<TaskListResponse>(this.baseEndpoint);
  }

  /**
   * Lista tasks de um worker específico
   */
  async listWorkerTasks(workerId: string): Promise<ApiResponse<Task[]>> {
    return api.get<Task[]>(`/worker/${workerId}/tasks`);
  }

  /**
   * Cria uma nova task/torrent para um worker específico
   */
  async createTask(workerId: string, taskData: CreateTaskRequest): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task`, taskData);
  }

  /**
   * Remove uma task/torrent
   */
  async deleteTask(workerId: string, taskId: string, purge: boolean = false): Promise<ApiResponse<null>> {
    const endpoint = `/worker/${workerId}/task/${taskId}${purge ? '?purge=true' : ''}`;
    return api.delete<null>(endpoint);
  }

  /**
   * Pausa uma task/torrent (stop)
   */
  async pauseTask(workerId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/stop`);
  }

  /**
   * Retoma uma task/torrent (start)
   */
  async resumeTask(workerId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/start`);
  }

  /**
   * Força download de uma task/torrent
   */
  async forceDownloadTask(workerId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/force_download`);
  }

  /**
   * Força reannounce de uma task/torrent
   */
  async forceReannounceTask(workerId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/force_reannounce`);
  }

  /**
   * Força recheck de uma task/torrent
   */
  async forceRecheckTask(workerId: string, taskId: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/force_recheck`);
  }

  /**
   * Ativa/desativa super seeding de uma task/torrent
   */
  async toggleSuperSeeding(workerId: string, taskId: string, enabled: boolean): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/super_seeding`, { enabled });
  }

  /**
   * Renomeia uma task/torrent
   */
  async renameTask(workerId: string, taskId: string, newName: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/rename`, { new_name: newName });
  }

  /**
   * Altera o caminho (location) de uma task/torrent
   */
  async setTaskLocation(workerId: string, taskId: string, location: string): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/location`, { location });
  }

  /**
   * Lista os arquivos de uma task/torrent específica
   */
  async listTaskFiles(workerId: string, taskId: string): Promise<ApiResponse<TaskFile[]>> {
    return api.get<TaskFile[]>(`/worker/${workerId}/task/${taskId}/files`);
  }

  /**
   * Atualiza as tags de uma task/torrent
   */
  async updateTaskTags(workerId: string, taskId: string, tags: string[]): Promise<ApiResponse<null>> {
    return api.put<null>(`/worker/${workerId}/task/${taskId}/tags`, { tags });
  }

  /**
   * Atualiza a categoria de uma task/torrent
   */
  async updateTaskCategory(workerId: string, taskId: string, category: string): Promise<ApiResponse<null>> {
    return api.put<null>(`/worker/${workerId}/task/${taskId}/category`, { category });
  }

  /**
   * Obtém os limites de uma task/torrent específica
   */
  async getTaskLimits(workerId: string, taskId: string): Promise<ApiResponse<TaskLimits>> {
    return api.get<TaskLimits>(`/worker/${workerId}/task/${taskId}/limits`);
  }

  /**
   * Define o limite de download de uma task/torrent
   */
  async setTaskDownloadLimit(workerId: string, taskId: string, limit: number): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/limit_download_rate`, { limit });
  }

  /**
   * Define o limite de upload de uma task/torrent
   */
  async setTaskUploadLimit(workerId: string, taskId: string, limit: number): Promise<ApiResponse<null>> {
    return api.post<null>(`/worker/${workerId}/task/${taskId}/limit_upload_rate`, { limit });
  }

  /**
   * Define o limite de compartilhamento (share limit) de uma task/torrent
   */
  async setTaskShareLimit(
    workerId: string,
    taskId: string,
    ratioLimit: number,
    seedingTimeLimit: number,
    inactiveSeedingTimeLimit: number
  ): Promise<ApiResponse<null>> {
    return api.put<null>(`/worker/${workerId}/task/${taskId}/share_limit`, {
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
