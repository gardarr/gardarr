import { api } from "@/lib/api";
import type { SetupStatus } from "@/types/setup";

type SetupResult =
  | { data: SetupStatus; error?: never }
  | { data?: never; error: string };

class SetupService {
  /**
   * Checks the current setup status
   * Validates if the system has been initialized and if statistics are enabled
   */
  async checkSetup(): Promise<SetupResult> {
    const response = await api.get<SetupStatus>("/setup");
    
    if (response.error) {
      return { error: response.error };
    }
    
    if (!response.data) {
      return { error: "No data received from server" };
    }
    
    return { data: response.data };
  }
}

export const setupService = new SetupService();

