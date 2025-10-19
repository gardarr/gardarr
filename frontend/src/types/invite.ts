export interface Invite {
  uuid: string;
  code: string;
  email?: string;
  role: 'admin' | 'user';
  created_by: string;
  created_at: string;
  expires_at: string;
  used: boolean;
  used_at?: string;
  used_by?: string;
}

export interface CreateInviteRequest {
  email?: string;
  role?: 'admin' | 'user';
  expires_in_hours?: number;
}

export interface ValidateInviteResponse {
  valid: boolean;
  invite?: Invite;
  error?: string;
}

export interface AcceptInviteRequest {
  code: string;
  email: string;
  password: string;
}

