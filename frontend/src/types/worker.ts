// Types for communication with the API v1/workers

export interface Worker {
  uuid: string;
  name: string;
  address: string;
  status: WorkerStatus;
  error?: string;
  error_code?: WorkerErrorCode;
  permanent?: boolean;
  instance: Instance;
  icon?: string;
  color?: string;
  version?: Version;
}

export interface Version {
  version: string;
  commit: string;
  date: string;
  qbittorrent_url?: string;
}

export type WorkerStatus = 'ACTIVE' | 'ERRORED' | 'INACTIVE' | 'INITIALIZING' | 'PENDING';

// Worker error codes for specific error handling
export type WorkerErrorCode =
  | 'AUTH_FAILURE'        // Invalid username/password - requires user intervention
  | 'TIMEOUT'             // Connection or request timeout - can retry
  | 'DNS_ERROR'           // DNS resolution failure - check hostname
  | 'HTTPS_REQUIRED'      // HTTP was used but HTTPS is required
  | 'SSL_ERROR'           // SSL/TLS certificate or connection error
  | 'VERSION_INCOMPATIBLE' // Incompatible qBittorrent version
  | 'CONNECTION_REFUSED'  // Server actively refused connection
  | 'NETWORK_UNREACHABLE' // Network routing issues
  | 'WORKER_UNREACHABLE'   // Gardarr worker is unreachable
  | 'BAD_GATEWAY'         // Proxy/gateway error (502)
  | 'SERVICE_UNAVAILABLE' // Service temporarily unavailable (503)
  | 'UNKNOWN';            // Unclassified error

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

export interface CreateWorkerRequest {
  name: string;
  type: string;
  address: string;
  token: string;
  icon?: string;
  color?: string;
}

export interface UpdateWorkerRequest {
  name?: string;
  address?: string;
  token?: string;
  icon?: string;
  color?: string;
}

export interface WorkerListResponse {
  data: Worker[];
}

export interface WorkerCreateResponse {
  data: Worker;
}

export interface WorkerDeleteResponse {
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
  total_tasks_count: number;
  active_seeds: number;
  active_peers: number;
  swarm_seeders: number; // total seeders in swarm for selected worker context
  swarm_leechers: number; // total leechers in swarm for selected worker context
  category_usage: Record<string, number>;
  tags_usage: Record<string, number>;
  word_cloud: Record<string, number>;
}

// Worker Preferences Types
export interface WorkerPreferences {
  global_rate_limits: {
    download_speed_limit: number;
    upload_speed_limit: number;
  };
  active_torrent_limits: {
    max_active_downloads: number;
    max_active_uploads: number;
    max_active_torrents: number;
    max_active_checking_torrents: number;
  };
}

// Speed Limits Schema
export interface SpeedLimitsSchema {
  download_limit: number; // -1 for unlimited
  upload_limit: number;   // -1 for unlimited
}

// Active Limits Schema
export interface ActiveLimitsSchema {
  max_active_downloads: number;
  max_active_uploads: number;
  max_active_torrents: number;
  max_active_checking_torrents: number;
}

export interface LogEntry {
  id: number;
  message: string;
  timestamp: number;
  type: 1 | 2 | 4 | 8;
}
