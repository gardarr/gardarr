import { api } from "@/lib/api";
import type { SetupStatus, CreateAdminRequest } from "@/types/setup";
import type { User } from "@/types/auth";

class SetupService {
  /**
   * Checks the current setup status
   * Validates if the system has been initialized and if statistics are enabled
   */
  async checkSetup(): Promise<{ data?: SetupStatus; error?: string }> {
    const response = await api.get<SetupStatus>("/setup");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Creates the first admin user during initial setup
   */
  async createAdmin(data: CreateAdminRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.post<{ user: User }>("/setup", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data?.user };
  }
}

export const setupService = new SetupService();

