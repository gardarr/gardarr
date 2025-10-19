import { api } from "@/lib/api";

export interface VersionResponse {
  version: string;
  commit: string;
  date: string;
}

class VersionService {
  /**
   * Gets the application version from the backend
   */
  async getVersion(): Promise<{ data?: VersionResponse; error?: string }> {
    const response = await api.get<VersionResponse>("/version");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }
}

export const versionService = new VersionService();
