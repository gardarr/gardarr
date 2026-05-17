// Tipos para comunicação com a API v1/tasks
import type { Worker } from "./worker";

export interface Task {
  id: string;
  worker?: Worker;
  name: string;
  hash: string;
  created_at: string;
  completed_at?: string | null;
  state: string;
  category: string;
  path: string;
  priority: number;
  ratio: number;
  size: number;
  progress: number;
  magnet_uri: string;
  magnet_link: TaskMagnetLink;
  popularity: number;
  super_seeding?: boolean;
  pairs: TaskPairs;
  network: TaskNetwork;
  tags?: string[];
  metadata?: TaskMetadata | null;
}

export interface TaskDownload {
  speed: number;
  amount: number;
}

export interface TaskUpload {
  speed: number;
  amount: number;
}

export interface TaskPairs {
  swarm_seeders: number;
  swarm_leechers: number;
  seeders: number;
  leechers: number;
}

export interface TaskNetwork {
  download: TaskDownload;
  upload: TaskUpload;
}

export interface TaskMagnetLink {
  hash: string;
  display_name: string;
  trackers: string[];
  exact_length: string;
  exact_source: string;
}

export interface CreateTaskRequest {
  magnet_uri: string;
  category: string;
  directory?: string;
  tags: string[];
}

export interface MetadataProviderSearchResult {
  id: string;
  title: string;
  release_date?: string;
  description?: string;
  image_id?: string;
  image_url?: string;
}

export interface CreatedTorrentState {
  task: Task;
  taskHash: string;
}

export interface DeleteTaskRequest {
  id: string;
  purge?: boolean;
}

export interface TaskListResponse {
  tasks: Task[];
  errors?: Record<string, string>;
}

export interface TaskCreateResponse {
  data: Task;
}

export interface TaskDeleteResponse {
  data: null;
}

export interface TaskFile {
  name: string;
  size: number;
  progress: number;
  priority: number;
  is_seed: boolean;
  piece_range: [number, number];
  availability: number;
}

export interface TaskLimits {
  download_limit: number;
  upload_limit: number;
  share_limit: number; // Deprecated: use specific limits below
  ratio_limit: number;
  seeding_time_limit: number;
  inactive_seeding_time_limit: number;
}

export interface TaskMetadata {
  uuid: string;
  task_hash: string;
  image_url?: string;
  thumbnail_url?: string;
  name?: string;
  release_date?: string;
  description?: string;
  warning?: string;
  warning_reason?: string;
  image_position_y?: number; // Vertical position offset in percentage (0-100)
  image_opacity?: number; // Image opacity in percentage (0-100)
  created_at: string;
  updated_at: string;
}
