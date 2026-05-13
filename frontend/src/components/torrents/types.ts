import type { TaskMetadata } from "@/types/torrent";
import type { WorkerStatus } from "@/types/worker";
import type { TorrentStatus } from "./TorrentStatusIcon";

export type SortType =
  | "priority"
  | "alphabetical"
  | "size"
  | "progress"
  | "download_speed"
  | "upload_speed"
  | "downloaded"
  | "uploaded";

export type TorrentListItem = {
  id: string;
  hash: string;
  name: string;
  totalSizeBytes: number;
  downloadRateBps: number;
  uploadRateBps: number;
  downloadedBytes: number;
  uploadedBytes: number;
  status: TorrentStatus;
  createdAt: string;
  progress: number;
  ratio: number;
  numSeeds: number;
  numLeechs: number;
  workerName?: string;
  workerStatus?: WorkerStatus | string;
  workerUUID?: string;
  workerIcon?: string;
  workerColor?: string;
  category: string;
  canSearchMetadata: boolean;
  tags: string[];
  metadata?: TaskMetadata | null;
};

export type MobileTorrent = TorrentListItem;

export interface TorrentActionHandlers {
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
  onSearchMetadata?: (taskId: string) => void;
  onMetrics?: (taskId: string, workerId?: string) => void;
  onLimits?: (taskId: string, workerId?: string) => void;
  onMetadataUpdate?: () => void;
}

export interface TorrentSelectionProps {
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestDelete?: (ids: string[]) => void;
}

export interface TorrentListDisplayProps {
  torrents: TorrentListItem[];
  compact?: boolean;
}

export interface TorrentPaginationProps {
  currentPage: number;
  totalPages: number;
  filteredTorrentsLength: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export type TorrentListProps = TorrentListDisplayProps & TorrentActionHandlers & TorrentSelectionProps;
