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
    const response = await api.get<User>("/auth/me");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { user: response.data };
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
}

export const authService = new AuthService();

