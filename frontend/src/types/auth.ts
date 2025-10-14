export interface User {
  uuid: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthError {
  error: string;
  details?: string;
  retry_after_seconds?: number;
}

