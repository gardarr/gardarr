import { api } from "@/lib/api";
import type { User, CreateUserRequest, UpdateUserRequest, ListUsersResponse } from "@/types/user";

class UserService {
  /**
   * Lists all users
   */
  async listUsers(): Promise<{ data?: ListUsersResponse; error?: string }> {
    const response = await api.get<ListUsersResponse>("/users");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Gets a specific user by UUID
   */
  async getUser(uuid: string): Promise<{ data?: User; error?: string }> {
    const response = await api.get<User>(`/users/${uuid}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Creates a new user
   */
  async createUser(data: CreateUserRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.post<User>("/users", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Updates a user
   */
  async updateUser(uuid: string, data: UpdateUserRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.put<User>(`/users/${uuid}`, data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Deletes a user
   */
  async deleteUser(uuid: string): Promise<{ error?: string }> {
    const response = await api.delete(`/users/${uuid}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }
}

export const userService = new UserService();

