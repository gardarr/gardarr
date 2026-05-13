import { api } from "../lib/api";
import type { ApiResponse } from "../lib/api";
import type { MetadataProviderSearchResult, TaskMetadata } from "../types/torrent";

const SEARCH_PREVIEW_TASK_HASH = "wizard-preview";

interface ProviderStatusResponse {
  provider: string;
  active: boolean;
}

interface ApplyProviderRequest {
  name: string;
  release_date: string;
  description: string;
  image_url: string;
}

class TaskMetadataService {
  async getProviderStatus(provider: string): Promise<ApiResponse<ProviderStatusResponse>> {
    return api.get<ProviderStatusResponse>(`/tasks/metadata/providers/${provider}/status`);
  }

  async searchProvider(provider: string, query: string): Promise<ApiResponse<MetadataProviderSearchResult[]>> {
    return api.get<MetadataProviderSearchResult[]>(
      `/tasks/metadata/${SEARCH_PREVIEW_TASK_HASH}/providers/${provider}/search?q=${encodeURIComponent(query)}`
    );
  }

  async applyProvider(
    taskHash: string,
    provider: string,
    payload: ApplyProviderRequest
  ): Promise<ApiResponse<TaskMetadata>> {
    return api.post<TaskMetadata>(`/tasks/metadata/${taskHash}/providers/${provider}`, payload);
  }

  async updateName(taskHash: string, name: string): Promise<ApiResponse<TaskMetadata>> {
    return api.put<TaskMetadata>(`/tasks/metadata/${taskHash}/name`, { name });
  }

  async updateDescription(taskHash: string, description: string): Promise<ApiResponse<TaskMetadata>> {
    return api.put<TaskMetadata>(`/tasks/metadata/${taskHash}/description`, { description });
  }

  async uploadImage(taskHash: string, file: File): Promise<ApiResponse<TaskMetadata>> {
    const formData = new FormData();
    formData.append("image", file);
    return api.post<TaskMetadata>(`/tasks/metadata/${taskHash}/image`, formData);
  }
}

export const taskMetadataService = new TaskMetadataService();
