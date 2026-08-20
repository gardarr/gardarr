import { api } from '../lib/api';
import type { ApiResponse } from '../lib/api';
import type {
  Tag,
  TagKind,
  CreateTagRequest,
  UpdateTagRequest,
  RenameTagRequest,
  MergeTagsRequest,
  TagOperationResult,
} from '../types/tag';

/**
 * Service for communication with the API v1/tags from the backend
 */
export class TagService {
  private readonly baseEndpoint = '/tags';

  /**
   * Lists the union of locally-stored tags and tags observed live on
   * workers, with usage counts
   */
  async listTags(): Promise<ApiResponse<Tag[]>> {
    return api.get<Tag[]>(this.baseEndpoint);
  }

  /**
   * Creates a new tag
   */
  async createTag(tagData: CreateTagRequest): Promise<ApiResponse<Tag>> {
    return api.post<Tag>(this.baseEndpoint, tagData);
  }

  /**
   * Updates an existing tag's color/icon (name and kind are immutable)
   */
  async updateTag(tagId: string, tagData: UpdateTagRequest): Promise<ApiResponse<Tag>> {
    return api.put<Tag>(`${this.baseEndpoint}/${tagId}`, tagData);
  }

  /**
   * Deletes a tag by name. A "tag" kind is deregistered from every worker
   * (detaching it from every torrent that carries it); a "scope" kind is
   * removed locally only, since it has no counterpart on qBittorrent.
   */
  async deleteTag(name: string, kind: TagKind = 'tag'): Promise<ApiResponse<TagOperationResult>> {
    const params = new URLSearchParams({ name, kind });
    return api.delete<TagOperationResult>(`${this.baseEndpoint}?${params.toString()}`);
  }

  /**
   * Renames a tag - a merge with a single source
   */
  async renameTag(renameData: RenameTagRequest): Promise<ApiResponse<TagOperationResult>> {
    return api.post<TagOperationResult>(`${this.baseEndpoint}/rename`, renameData);
  }

  /**
   * Merges one or more source tags into a target tag
   */
  async mergeTags(mergeData: MergeTagsRequest): Promise<ApiResponse<TagOperationResult>> {
    return api.post<TagOperationResult>(`${this.baseEndpoint}/merge`, mergeData);
  }
}

// Default service instance
export const tagService = new TagService();
