/**
 * Setup status types
 */

export interface SetupStatus {
  initialized: boolean;
  statistics_enabled: boolean;
}

export interface CreateAdminRequest {
  email: string;
  password: string;
}

