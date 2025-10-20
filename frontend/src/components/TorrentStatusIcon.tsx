import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  PauseCircle, 
  Info, 
  Clock, 
  Play, 
  RotateCcw, 
  HardDrive, 
  XCircle, 
  FileX 
} from "lucide-react";

export type TorrentStatus = 
  | "ERROR" 
  | "MISSING_FILES"
  | "UPLOADING"
  | "PAUSED_UPLOAD"
  | "STOPPED_UPLOAD"
  | "QUEUED_UPLOAD"
  | "STALLED_UPLOAD"
  | "CHECKING_UPLOAD"
  | "FORCED_UPLOAD"
  | "ALLOCATING"
  | "DOWNLOADING"
  | "METADATA_DOWNLOAD"
  | "FORCED_METADATA_DOWNLOAD"
  | "PAUSED_DOWNLOAD"
  | "STOPPED_DOWNLOAD"
  | "QUEUED_DOWNLOAD"
  | "FORCED_DOWNLOAD"
  | "STALLED_DOWNLOAD"
  | "CHECKING_DOWNLOAD"
  | "CHECKING_RESUME_DATA"
  | "MOVING"
  | "UNKNOWN";

export function getStatusIcon(status: TorrentStatus) {
  switch (status) {
    // Error states - highest priority
    case "ERROR":
      return XCircle;
    case "MISSING_FILES":
      return FileX;
    
    // Download states - second priority
    case "DOWNLOADING":
      return ArrowDownCircle;
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return Info;
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return PauseCircle;
    case "QUEUED_DOWNLOAD":
      return Clock;
    case "FORCED_DOWNLOAD":
      return Play;
    case "STALLED_DOWNLOAD":
      return PauseCircle;
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return RotateCcw;
    
    // Upload states - third priority
    case "UPLOADING":
      return ArrowUpCircle;
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return PauseCircle;
    case "QUEUED_UPLOAD":
      return Clock;
    case "STALLED_UPLOAD":
      return PauseCircle;
    case "CHECKING_UPLOAD":
      return RotateCcw;
    case "FORCED_UPLOAD":
      return Play;
    
    // Other states - lowest priority
    case "ALLOCATING":
      return HardDrive;
    case "MOVING":
      return ArrowUpCircle;
    case "UNKNOWN":
    default:
      return Info;
  }
}

export function getStatusColor(status: TorrentStatus): string {
  switch (status) {
    // Error states - red colors
    case "ERROR":
      return "text-red-600";
    case "MISSING_FILES":
      return "text-red-500";
    
    // Download states - green colors
    case "DOWNLOADING":
      return "text-green-600";
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return "text-green-500";
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return "text-orange-500";
    case "QUEUED_DOWNLOAD":
      return "text-green-400";
    case "FORCED_DOWNLOAD":
      return "text-green-700";
    case "STALLED_DOWNLOAD":
      return "text-orange-600";
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return "text-cyan-500";
    
    // Upload states - purple/lilac colors
    case "UPLOADING":
      return "text-purple-600";
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return "text-orange-500";
    case "QUEUED_UPLOAD":
      return "text-purple-400";
    case "STALLED_UPLOAD":
      return "text-orange-600";
    case "CHECKING_UPLOAD":
      return "text-cyan-500";
    case "FORCED_UPLOAD":
      return "text-purple-700";
    
    // Other states - neutral colors
    case "ALLOCATING":
      return "text-indigo-500";
    case "MOVING":
      return "text-indigo-500";
    case "UNKNOWN":
    default:
      return "text-gray-500";
  }
}

export function getStatusBackgroundColor(status: TorrentStatus): string {
  switch (status) {
    // Error states - light red backgrounds
    case "ERROR":
      return "bg-red-50 dark:bg-red-950/20";
    case "MISSING_FILES":
      return "bg-red-50 dark:bg-red-950/20";
    
    // Download states - light green backgrounds
    case "DOWNLOADING":
      return "bg-green-50 dark:bg-green-950/20";
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "QUEUED_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "FORCED_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
    case "STALLED_DOWNLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
      return "bg-cyan-50 dark:bg-cyan-950/20";
    
    // Upload states - light purple backgrounds
    case "UPLOADING":
      return "bg-purple-50 dark:bg-purple-950/20";
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "QUEUED_UPLOAD":
      return "bg-purple-50 dark:bg-purple-950/20";
    case "STALLED_UPLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
    case "CHECKING_UPLOAD":
      return "bg-cyan-50 dark:bg-cyan-950/20";
    case "FORCED_UPLOAD":
      return "bg-purple-50 dark:bg-purple-950/20";
    
    // Other states - light neutral backgrounds
    case "ALLOCATING":
      return "bg-indigo-50 dark:bg-indigo-950/20";
    case "MOVING":
      return "bg-indigo-50 dark:bg-indigo-950/20";
    case "UNKNOWN":
    default:
      return "bg-gray-50 dark:bg-gray-950/20";
  }
}
