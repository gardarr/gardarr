import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TagService } from './tags';
import { api } from '../lib/api';
import type {
  Tag,
  CreateTagRequest,
  UpdateTagRequest,
  RenameTagRequest,
  MergeTagsRequest,
  DeriveTagsRequest,
  DeriveTagsResult,
  TagOperationResult,
  TagConflictReport,
} from '../types/tag';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('TagService', () => {
  let tagService: TagService;

  beforeEach(() => {
    tagService = new TagService();
    vi.clearAllMocks();
  });

  describe('listTags', () => {
    it('calls api.get with the tags endpoint', async () => {
      const mockTags: Tag[] = [];
      vi.mocked(api.get).mockResolvedValue({ data: mockTags, error: undefined });

      await tagService.listTags();

      expect(api.get).toHaveBeenCalledWith('/tags');
    });

    it('returns tags from the API', async () => {
      const mockTags: Tag[] = [
        {
          id: '1',
          name: 'movies',
          kind: 'tag',
          usage_count: 3,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];
      vi.mocked(api.get).mockResolvedValue({ data: mockTags, error: undefined });

      const result = await tagService.listTags();

      expect(result.data).toEqual(mockTags);
      expect(result.error).toBeUndefined();
    });
  });

  describe('createTag', () => {
    it('calls api.post with the tags endpoint and payload', async () => {
      const tagData: CreateTagRequest = { name: 'movies', kind: 'tag' };
      vi.mocked(api.post).mockResolvedValue({ data: {} as Tag, error: undefined });

      await tagService.createTag(tagData);

      expect(api.post).toHaveBeenCalledWith('/tags', tagData);
    });
  });

  describe('updateTag', () => {
    it('calls api.put with the tag id in the path', async () => {
      const tagData: UpdateTagRequest = { color: '#ff0000' };
      vi.mocked(api.put).mockResolvedValue({ data: {} as Tag, error: undefined });

      await tagService.updateTag('tag-123', tagData);

      expect(api.put).toHaveBeenCalledWith('/tags/tag-123', tagData);
    });
  });

  describe('deleteTag', () => {
    it('defaults kind to "tag" when not specified', async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: {} as TagOperationResult, error: undefined });

      await tagService.deleteTag('movies');

      expect(api.delete).toHaveBeenCalledWith('/tags?name=movies&kind=tag');
    });

    it('passes an explicit "scope" kind through', async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: {} as TagOperationResult, error: undefined });

      await tagService.deleteTag('quality', 'scope');

      expect(api.delete).toHaveBeenCalledWith('/tags?name=quality&kind=scope');
    });
  });

  describe('renameTag', () => {
    it('calls api.post with the rename endpoint and payload', async () => {
      const renameData: RenameTagRequest = { from: 'old', to: 'new' };
      vi.mocked(api.post).mockResolvedValue({ data: {} as TagOperationResult, error: undefined });

      await tagService.renameTag(renameData);

      expect(api.post).toHaveBeenCalledWith('/tags/rename', renameData);
    });
  });

  describe('mergeTags', () => {
    it('calls api.post with the merge endpoint and payload', async () => {
      const mergeData: MergeTagsRequest = { sources: ['a', 'b'], target: 'c' };
      vi.mocked(api.post).mockResolvedValue({ data: {} as TagOperationResult, error: undefined });

      await tagService.mergeTags(mergeData);

      expect(api.post).toHaveBeenCalledWith('/tags/merge', mergeData);
    });
  });

  describe('deriveTags', () => {
    it('calls api.post with the derive endpoint and payload', async () => {
      const deriveData: DeriveTagsRequest = {
        source: 'quality::4k',
        values: ['1080p', '720p'],
      };
      const mockResult: DeriveTagsResult = { created: [] };
      vi.mocked(api.post).mockResolvedValue({ data: mockResult, error: undefined });

      const result = await tagService.deriveTags(deriveData);

      expect(api.post).toHaveBeenCalledWith('/tags/derive', deriveData);
      expect(result.data).toEqual(mockResult);
    });
  });

  describe('getConflicts', () => {
    it('calls api.get with the conflicts endpoint', async () => {
      const mockReport: TagConflictReport = { scope_conflicts: [], grouped_tags: [] };
      vi.mocked(api.get).mockResolvedValue({ data: mockReport, error: undefined });

      const result = await tagService.getConflicts();

      expect(api.get).toHaveBeenCalledWith('/tags/conflicts');
      expect(result.data).toEqual(mockReport);
    });
  });

  describe('error handling', () => {
    it('propagates API errors from listTags', async () => {
      vi.mocked(api.get).mockResolvedValue({ data: null, error: 'Network error' });

      const result = await tagService.listTags();

      expect(result.data).toBeNull();
      expect(result.error).toBe('Network error');
    });

    it('propagates API errors from createTag', async () => {
      vi.mocked(api.post).mockResolvedValue({ data: undefined, error: 'Invalid request' });

      const result = await tagService.createTag({ name: 'movies' });

      expect(result.data).toBeUndefined();
      expect(result.error).toBe('Invalid request');
    });

    it('propagates API errors from deleteTag', async () => {
      vi.mocked(api.delete).mockResolvedValue({ data: null, error: 'Not found' });

      const result = await tagService.deleteTag('movies');

      expect(result.data).toBeNull();
      expect(result.error).toBe('Not found');
    });
  });
});
