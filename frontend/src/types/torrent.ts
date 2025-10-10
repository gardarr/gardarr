// Tipos para comunicação com a API v1/tasks
import type { Agent } from "./agent";

export interface Task {
  id: string;
  agent_id: string;
  agent?: Agent;
  name: string;
  hash: string;
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
  pairs: TaskPairs;
  network: TaskNetwork;
  tags?: string[];
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
  tags: string[];
}

export interface DeleteTaskRequest {
  id: string;
  purge?: boolean;
}

export interface TaskListResponse {
  data: Task[];
}

export interface TaskCreateResponse {
  data: null;
}

export interface TaskDeleteResponse {
  data: null;
}
