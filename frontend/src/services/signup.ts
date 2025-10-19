import { api } from "@/lib/api";
import type { 
  SignupToken, 
  CreateSignupTokenRequest, 
  SignupTokenResponse,
  VerifySignupTokenRequest,
  PublicSignupRequest
} from "@/types/signup";
import type { User } from "@/types/auth";

class SignupService {
  /**
   * Lists all magic links
   */
  async listMagicLinks(): Promise<{ data?: SignupToken[]; error?: string }> {
    const response = await api.get<{ tokens: SignupToken[]; total: number }>("/signup/magic_link");
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data?.tokens || [] };
  }

  /**
   * Creates a new magic link for signup
   */
  async createMagicLink(data: CreateSignupTokenRequest): Promise<{ data?: SignupTokenResponse; error?: string }> {
    const response = await api.post<SignupTokenResponse>("/signup/magic_link", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data };
  }

  /**
   * Revokes a magic link token
   */
  async revokeMagicLink(token: string): Promise<{ error?: string }> {
    const response = await api.delete(`/signup/magic_link/${encodeURIComponent(token)}`);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return {};
  }

  /**
   * Verifies a magic link token and creates a user account
   */
  async verifySignup(data: VerifySignupTokenRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.post<{ user: User }>("/signup/verify", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data?.user };
  }

  /**
   * Generates the signup URL for sharing (frontend route)
   */
  getSignupUrl(token: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup/${encodeURIComponent(token)}`;
  }

  /**
   * Creates a user account via public signup (for initial setup)
   */
  async publicSignup(data: PublicSignupRequest): Promise<{ data?: User; error?: string }> {
    const response = await api.post<{ user: User }>("/setup", data);
    
    if (response.error) {
      return { error: response.error };
    }
    
    return { data: response.data?.user };
  }

  /**
   * Checks if the system has been initialized (setup completed)
   */
  async needsSetup(): Promise<{ data?: { needs_setup: boolean }; error?: string }> {
    const response = await api.get<{ initialized: boolean }>("/setup");
    
    if (response.error) {
      return { error: response.error };
    }
    
    // Invert the logic: if initialized is true, needs_setup is false
    return { data: { needs_setup: !response.data?.initialized } };
  }
}

export const signupService = new SignupService();

