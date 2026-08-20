// Types for communication with the API v1/tags

export type TagKind = "tag" | "scope";

export interface Tag {
  id: string;
  name: string;
  kind: TagKind;
  color?: string;
  icon?: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTagRequest {
  name: string;
  kind?: TagKind;
  color?: string;
  icon?: string;
}

export interface UpdateTagRequest {
  color?: string;
  icon?: string;
}

export interface RenameTagRequest {
  from: string;
  to: string;
}

export interface MergeTagsRequest {
  sources: string[];
  target: string;
}

// failed_workers maps a worker's UUID to its error message, and is present
// (possibly empty/null) on every delete/rename/merge response - the local
// side always succeeds or fails as a whole, but pushing the change to each
// worker's qBittorrent server is best-effort per worker.
export interface TagOperationResult {
  failed_workers?: Record<string, string> | null;
}
