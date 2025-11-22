import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupService } from '../setup';
import { api } from '../../lib/api';
import type { SetupStatus, CreateAdminRequest } from '../../types/setup';
import type { User } from '../../types/auth';
import { generateRandomEmail, generateRandomPassword } from '../../utils/testUtils';

// Mock the api module
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('SetupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkSetup', () => {
    it('should call api.get with correct endpoint', async () => {
      const mockStatus: SetupStatus = {
        initialized: true,
        statistics_enabled: true,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      await setupService.checkSetup();

      expect(api.get).toHaveBeenCalledWith('/setup');
    });

    it('should return setup status from API when initialized', async () => {
      const mockStatus: SetupStatus = {
        initialized: true,
        statistics_enabled: true,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      const result = await setupService.checkSetup();

      expect(result.data).toEqual(mockStatus);
      expect(result.error).toBeUndefined();
    });

    it('should return setup status from API when not initialized', async () => {
      const mockStatus: SetupStatus = {
        initialized: false,
        statistics_enabled: false,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      const result = await setupService.checkSetup();

      expect(result.data).toEqual(mockStatus);
      expect(result.data?.initialized).toBe(false);
      expect(result.data?.statistics_enabled).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('should return error when API call fails', async () => {
      const errorMessage = 'Failed to check setup status';
      vi.mocked(api.get).mockResolvedValue({ 
        data: undefined, 
        error: errorMessage 
      });

      const result = await setupService.checkSetup();

      expect(result.data).toBeUndefined();
      expect(result.error).toBe(errorMessage);
    });
  });

  describe('createAdmin', () => {
    it('should call api.post with correct endpoint and data', async () => {
      const testEmail = generateRandomEmail('admin');
      const testPassword = generateRandomPassword();
      const adminData: CreateAdminRequest = {
        email: testEmail,
        password: testPassword,
      };
      const mockUser: User = {
        uuid: 'user-123',
        email: testEmail,
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };
      vi.mocked(api.post).mockResolvedValue({ 
        data: { user: mockUser }, 
        error: undefined 
      });

      await setupService.createAdmin(adminData);

      expect(api.post).toHaveBeenCalledWith('/setup', adminData);
    });

    it('should return user from API on success', async () => {
      const testEmail = generateRandomEmail('admin');
      const testPassword = generateRandomPassword();
      const adminData: CreateAdminRequest = {
        email: testEmail,
        password: testPassword,
      };
      const mockUser: User = {
        uuid: 'user-123',
        email: testEmail,
        role: 'admin',
        created_at: '2024-01-01T00:00:00Z',
      };
      vi.mocked(api.post).mockResolvedValue({ 
        data: { user: mockUser }, 
        error: undefined 
      });

      const result = await setupService.createAdmin(adminData);

      expect(result.data).toEqual(mockUser);
      expect(result.error).toBeUndefined();
    });

    it('should return error when API call fails', async () => {
      const testEmail = generateRandomEmail('admin');
      const testPassword = generateRandomPassword();
      const adminData: CreateAdminRequest = {
        email: testEmail,
        password: testPassword,
      };
      const errorMessage = 'System is already initialized';
      vi.mocked(api.post).mockResolvedValue({ 
        data: undefined, 
        error: errorMessage 
      });

      const result = await setupService.createAdmin(adminData);

      expect(result.data).toBeUndefined();
      expect(result.error).toBe(errorMessage);
    });

    it('should return error when validation fails', async () => {
      const adminData: CreateAdminRequest = {
        email: 'invalid-email',
        password: 'short',
      };
      const errorMessage = 'Invalid request body';
      vi.mocked(api.post).mockResolvedValue({ 
        data: undefined, 
        error: errorMessage 
      });

      const result = await setupService.createAdmin(adminData);

      expect(result.data).toBeUndefined();
      expect(result.error).toBe(errorMessage);
    });
  });
});

