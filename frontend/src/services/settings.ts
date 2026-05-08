import { api } from "@/lib/api";

export interface TimezoneResponse {
  timezone: string;
  updated_at: string;
}

export interface LanguageResponse {
  default_language: string;
  updated_at: string;
}

export interface ThemeResponse {
  default_theme: string;
  updated_at: string;
}

export interface TimezoneInfo {
  value: string;
  label: string;
}

export interface TimezoneListResponse {
  timezones: TimezoneInfo[];
  total: number;
}

export interface TimezoneUpdateRequest {
  timezone: string;
}

export interface LanguageUpdateRequest {
  language: string;
}

export interface ThemeUpdateRequest {
  theme: string;
}

export interface WorkerImageStats {
  worker_id: string;
  worker_name: string;
  is_removed: boolean;
  image_count: number;
  total_size_bytes: number;
}

export interface ImageStorageStatsResponse {
  workers: WorkerImageStats[];
  orphan_count: number;
  orphan_size_bytes: number;
  total_size_bytes: number;
  total_image_count: number;
}

export interface DeleteImagesResponse {
  message: string;
  deleted_count: number;
}

class SettingsService {
  /**
   * Gets the current system timezone
   */
  async getTimezone(): Promise<{ data?: TimezoneResponse; error?: string }> {
    const response = await api.get<TimezoneResponse>("/settings/timezone");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Updates the system timezone
   */
  async updateTimezone(timezone: string): Promise<{ error?: string }> {
    const response = await api.put("/settings/timezone", { timezone });
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Gets the list of available timezones
   */
  async getTimezones(): Promise<{ data?: TimezoneListResponse; error?: string }> {
    const response = await api.get<TimezoneListResponse>("/settings/timezones");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Gets the current system language
   */
  async getLanguage(): Promise<{ data?: LanguageResponse; error?: string }> {
    const response = await api.get<LanguageResponse>("/settings/language");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Updates the system language
   */
  async updateLanguage(language: string): Promise<{ error?: string }> {
    const response = await api.put("/settings/language", { language });
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Gets the current system theme
   */
  async getTheme(): Promise<{ data?: ThemeResponse; error?: string }> {
    const response = await api.get<ThemeResponse>("/settings/theme");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Updates the system theme
   */
  async updateTheme(theme: string): Promise<{ error?: string }> {
    const response = await api.put("/settings/theme", { theme });
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }
  /**
   * Gets image storage stats per worker
   */
  async getImageStorageStats(): Promise<{ data?: ImageStorageStatsResponse; error?: string }> {
    const response = await api.get<ImageStorageStatsResponse>("/settings/images/stats");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Deletes all images for a specific worker
   */
  async deleteWorkerImages(workerId: string): Promise<{ data?: DeleteImagesResponse; error?: string }> {
    const response = await api.delete<DeleteImagesResponse>(`/settings/images/worker/${workerId}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Deletes orphan image files not referenced by any task
   */
  async deleteOrphanImages(): Promise<{ data?: DeleteImagesResponse; error?: string }> {
    const response = await api.delete<DeleteImagesResponse>("/settings/images/orphans");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }
}

export const settingsService = new SettingsService();
