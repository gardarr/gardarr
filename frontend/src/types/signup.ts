/**
 * Signup token (magic link) types
 */

export interface SignupToken {
  token: string;
  email?: string;
  role: string;
  expires_at: string;
  created_at: string;
  used_at?: string;
  used?: boolean;
}

export interface CreateSignupTokenRequest {
  role: string;
  expires_in: number; // hours
  email?: string;
}

export interface VerifySignupTokenRequest {
  token: string;
  email: string;
  password: string;
}

export interface SignupTokenResponse {
  token: string;
  email?: string;
  role: string;
  expires_at: string;
  created_at: string;
}

/**
 * Public signup request (for initial setup)
 */
export interface PublicSignupRequest {
  email: string;
  password: string;
  username?: string;
}

