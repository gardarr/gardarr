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

// A single torrent holding more than one value for the same exclusive
// scope (e.g. "quality::4k" and "quality::1080p" together) - invalid
// under the scoped-tag rules, reported rather than silently reconciled.
export interface ScopeConflict {
  worker_id: string;
  task_hash: string;
  task_name: string;
  scope: string;
  tags: string[];
}

export interface TagConflictReport {
  scope_conflicts: ScopeConflict[];
  // Tags using a single ":" (grouped semantics) observed on any worker -
  // worth reviewing since that separator had no meaning before scoped
  // tags existed.
  grouped_tags: string[];
}
