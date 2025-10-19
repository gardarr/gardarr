import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TorrentService } from './torrents';
import { api } from '../lib/api';
import type { Task, CreateTaskRequest } from '../types/torrent';

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TorrentService', () => {
  let torrentService: TorrentService;

  beforeEach(() => {
    torrentService = new TorrentService();
    vi.clearAllMocks();
  });

  describe('listTasks', () => {
    it('should call api.get with correct endpoint', async () => {
      const mockTasks: Task[] = [];
      vi.mocked(api.get).mockResolvedValue({ data: mockTasks, error: null });

      await torrentService.listTasks();

      expect(api.get).toHaveBeenCalledWith('/agents/tasks');
    });

    it('should return tasks from API', async () => {
      const mockTasks: Task[] = [
        {
          id: '1',
          name: 'Test Torrent',
          hash: 'abc123',
          size: 1000,
          progress: 50,
          state: 'DOWNLOADING',
          ratio: 0.5,
          category: 'movies',
          tags: ['test'],
          priority: 1,
          popularity: 10,
          magnet_uri: 'magnet:?xt=urn:btih:abc123',
          path: '/downloads/test',
          network: {
            download: { speed: 1000, amount: 500 },
            upload: { speed: 500, amount: 250 },
          },
          pairs: {
            seeders: 10,
            leechers: 5,
            swarm_seeders: 20,
            swarm_leechers: 10,
          },
        },
      ];
      vi.mocked(api.get).mockResolvedValue({ data: mockTasks, error: null });

      const result = await torrentService.listTasks();

      expect(result.data).toEqual(mockTasks);
      expect(result.error).toBeNull();
    });
  });

  describe('createTask', () => {
    it('should call api.post with correct endpoint and data', async () => {
      const agentId = 'agent-123';
      const taskData: CreateTaskRequest = {
        urls: 'magnet:?xt=urn:btih:abc123',
        category: 'movies',
        tags: 'test',
      };
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      await torrentService.createTask(agentId, taskData);

      expect(api.post).toHaveBeenCalledWith(`/agent/${agentId}/task`, taskData);
    });

    it('should return response from API', async () => {
      const agentId = 'agent-123';
      const taskData: CreateTaskRequest = {
        urls: 'magnet:?xt=urn:btih:abc123',
      };
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      const result = await torrentService.createTask(agentId, taskData);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('deleteTask', () => {
    it('should call api.delete with correct endpoint without purge', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.delete).mockResolvedValue({ data: null, error: null });

      await torrentService.deleteTask(agentId, taskId);

      expect(api.delete).toHaveBeenCalledWith(`/agent/${agentId}/task/${taskId}`);
    });

    it('should call api.delete with correct endpoint with purge', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.delete).mockResolvedValue({ data: null, error: null });

      await torrentService.deleteTask(agentId, taskId, true);

      expect(api.delete).toHaveBeenCalledWith(`/agent/${agentId}/task/${taskId}?purge=true`);
    });

    it('should return response from API', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.delete).mockResolvedValue({ data: null, error: null });

      const result = await torrentService.deleteTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('pauseTask', () => {
    it('should call api.post with correct stop endpoint', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      await torrentService.pauseTask(agentId, taskId);

      expect(api.post).toHaveBeenCalledWith(`/agent/${agentId}/task/${taskId}/stop`);
    });

    it('should return response from API', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      const result = await torrentService.pauseTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('resumeTask', () => {
    it('should call api.post with correct start endpoint', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      await torrentService.resumeTask(agentId, taskId);

      expect(api.post).toHaveBeenCalledWith(`/agent/${agentId}/task/${taskId}/start`);
    });

    it('should return response from API', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      const result = await torrentService.resumeTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('forceDownloadTask', () => {
    it('should call api.post with correct force_download endpoint', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      await torrentService.forceDownloadTask(agentId, taskId);

      expect(api.post).toHaveBeenCalledWith(`/agent/${agentId}/task/${taskId}/force_download`);
    });

    it('should return response from API', async () => {
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: null });

      const result = await torrentService.forceDownloadTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle API errors in listTasks', async () => {
      const errorMessage = 'Network error';
      vi.mocked(api.get).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.listTasks();

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle API errors in createTask', async () => {
      const errorMessage = 'Invalid request';
      const agentId = 'agent-123';
      const taskData: CreateTaskRequest = {
        urls: 'invalid-url',
      };
      vi.mocked(api.post).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.createTask(agentId, taskData);

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle API errors in deleteTask', async () => {
      const errorMessage = 'Not found';
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.delete).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.deleteTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle API errors in pauseTask', async () => {
      const errorMessage = 'Task already paused';
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.pauseTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle API errors in resumeTask', async () => {
      const errorMessage = 'Task already running';
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.resumeTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });

    it('should handle API errors in forceDownloadTask', async () => {
      const errorMessage = 'Unable to force download';
      const agentId = 'agent-123';
      const taskId = 'task-456';
      vi.mocked(api.post).mockResolvedValue({ data: null, error: errorMessage });

      const result = await torrentService.forceDownloadTask(agentId, taskId);

      expect(result.data).toBeNull();
      expect(result.error).toBe(errorMessage);
    });
  });
});

