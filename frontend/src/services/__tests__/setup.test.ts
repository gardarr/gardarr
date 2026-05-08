import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupService } from '../setup';
import { api } from '../../lib/api';
import type { SetupStatus } from '../../types/setup';

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
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      await setupService.checkSetup();

      expect(api.get).toHaveBeenCalledWith('/setup');
    });

    it('should return setup status from API when initialized', async () => {
      const mockStatus: SetupStatus = {
        initialized: true,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      const result = await setupService.checkSetup();

      expect(result.data).toEqual(mockStatus);
      expect(result.error).toBeUndefined();
    });

    it('should return setup status from API when not initialized', async () => {
      const mockStatus: SetupStatus = {
        initialized: false,
      };
      vi.mocked(api.get).mockResolvedValue({ data: mockStatus, error: undefined });

      const result = await setupService.checkSetup();

      expect(result.data).toEqual(mockStatus);
      expect(result.data?.initialized).toBe(false);
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
});

