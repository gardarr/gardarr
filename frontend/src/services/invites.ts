import { api } from "@/lib/api";
import type { 
  Invite, 
  CreateInviteRequest, 
  ValidateInviteResponse,
  AcceptInviteRequest 
} from "@/types/invite";
import type { User } from "@/types/auth";

class InviteService {
  /**
   * Lists all invites
   */
  async listInvites(): Promise<{ data?: Invite[]; error?: string }> {
    const response = await api.get<Invite[]>("/invites");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Creates a new invite
   */
  async createInvite(data: CreateInviteRequest): Promise<{ data?: Invite; error?: string }> {
    const response = await api.post<Invite>("/invites", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Validates an invite code
   */
  async validateInvite(code: string): Promise<{ data?: ValidateInviteResponse; error?: string }> {
    const response = await api.get<ValidateInviteResponse>(`/invites/validate/${code}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Accepts an invite and creates a user account
   */
  async acceptInvite(data: AcceptInviteRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.post<User>("/invites/accept", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Revokes an invite
   */
  async revokeInvite(uuid: string): Promise<{ error?: string }> {
    const response = await api.delete(`/invites/${uuid}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Generates the invite URL for sharing
   */
  getInviteUrl(code: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${code}`;
  }
}

export const inviteService = new InviteService();

