export interface User {
  uuid: string;
  email: string;
  created_at: string;
  role?: 'admin' | 'user';
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface UpdateUserRequest {
  email?: string;
  password?: string;
  role?: 'admin' | 'user';
}

export interface ListUsersResponse {
  users: User[];
  total: number;
}

