import { api } from "@/lib/api";
import type { AuthResponse, LoginRequest, RegisterRequest, User } from "@/types/auth";

class AuthService {
  /**
   * Registers a new user
   */
  async register(data: RegisterRequest): Promise<{ user?: User; error?: string }> {
    const response = await api.post<AuthResponse>("/auth/register", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { user: response.data?.user };
  }

  /**
   * Logs in a user
   */
  async login(data: LoginRequest): Promise<{ user?: User; error?: string }> {
    const response = await api.post<AuthResponse>("/auth/login", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { user: response.data?.user };
  }

  /**
   * Logs out the current user
   */
  async logout(): Promise<{ error?: string }> {
    const response = await api.post("/auth/logout");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Gets the current authenticated user
   */
  async getCurrentUser(): Promise<{ user?: User; error?: string }> {
    const response = await api.get<AuthResponse>("/auth/me");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { user: response.data?.user };
  }

  /**
   * Logs out from all devices
   */
  async logoutAll(): Promise<{ error?: string }> {
    const response = await api.post("/auth/logout-all");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Requests a password reset for a user (admin only)
   */
  async requestPasswordReset(userUuid: string): Promise<{ data?: { token: string; email: string; expires_at: string; created_at: string }; error?: string }> {
    const response = await api.post<{ token: string; email: string; expires_at: string; created_at: string }>(`/users/${userUuid}/password/request_reset`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Resets password using a reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<{ error?: string }> {
    const response = await api.post("/auth/reset_password", { 
      token, 
      new_password: newPassword 
    });
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }
}

export const authService = new AuthService();

