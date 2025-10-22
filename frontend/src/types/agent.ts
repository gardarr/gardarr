// Types for communication with the API v1/agents

export interface Agent {
  uuid: string;
  name: string;
  address: string;
  status: AgentStatus;
  error?: string;
  instance: Instance;
  icon?: string;
  color?: string;
  version?: Version;
  standalone?: boolean;
}

export interface Version {
  version: string;
  commit: string;
  date: string;
}

export type AgentStatus = 'ACTIVE' | 'ERRORED' | 'INACTIVE';

export interface Instance {
  application: InstanceApplication;
  server: InstanceServer;
  transfer: InstanceTransfer;
}

export interface InstanceApplication {
  version: string;
  api_version: string;
}

export interface InstanceServer {
  free_space_on_disk: number;
}

export interface InstanceTransfer {
  all_time_downloaded: number;
  all_time_uploaded: number;
  global_ratio: number;
  last_external_address_v4: string;
  last_external_address_v6: string;
}

export interface CreateAgentRequest {
  name: string;
  type: string;
  address: string;
  token: string;
  icon?: string;
  color?: string;
}

export interface UpdateAgentRequest {
  name?: string;
  address?: string;
  token?: string;
  icon?: string;
  color?: string;
}

export interface AgentListResponse {
  data: Agent[];
}

export interface AgentCreateResponse {
  data: Agent;
}

export interface AgentDeleteResponse {
  data: null;
}

export interface TaskStats {
  total_disk_size: number;
  current_upload_speed: number;
  current_download_speed: number;
  average_ratio: number;
  median_ratio: number;
  highest_ratio: number;
  lowest_ratio: number;
  active_tasks_count: number;
  active_seeds: number;
  active_peers: number;
  category_usage: Record<string, number>;
  tags_usage: Record<string, number>;
}
