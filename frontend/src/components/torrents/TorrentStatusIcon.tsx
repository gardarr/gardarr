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
import type { TaskStatus } from "@/utils/statusUtils";

// Export TaskStatus as TorrentStatus for backward compatibility
export type TorrentStatus = TaskStatus;

export function getStatusIcon(status: TaskStatus) {
  switch (status) {
    case "ERROR":
      return XCircle;
    case "MISSING_FILES":
      return FileX;
    
    case "DOWNLOADING":
      return ArrowDownCircle;
    
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
    case "UNKNOWN":
    default:
      return Info;
      
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
    case "STALLED_DOWNLOAD":
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
    case "STALLED_UPLOAD":
      return PauseCircle;
      
    case "QUEUED_DOWNLOAD":
    case "QUEUED_UPLOAD":
      return Clock;
      
    case "FORCED_DOWNLOAD":
    case "FORCED_UPLOAD":
      return Play;
      
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
    case "CHECKING_UPLOAD":
      return RotateCcw;
      
    case "UPLOADING":
    case "MOVING":
      return ArrowUpCircle;
      
    case "ALLOCATING":
      return HardDrive;
  }
}

export function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case "ERROR":
      return "text-red-600";
    case "MISSING_FILES":
      return "text-red-500";
      
    case "DOWNLOADING":
      return "text-green-600";
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
      return "text-green-500";
    case "QUEUED_DOWNLOAD":
      return "text-green-400";
    case "FORCED_DOWNLOAD":
      return "text-green-700";
      
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
      return "text-orange-500";
      
    case "STALLED_DOWNLOAD":
    case "STALLED_UPLOAD":
      return "text-orange-600";
      
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
    case "CHECKING_UPLOAD":
      return "text-cyan-500";
      
    case "UPLOADING":
      return "text-purple-600";
    case "QUEUED_UPLOAD":
      return "text-purple-400";
    case "FORCED_UPLOAD":
      return "text-purple-700";
      
    case "ALLOCATING":
    case "MOVING":
      return "text-indigo-500";
      
    case "UNKNOWN":
    default:
      return "text-gray-500";
  }
}

export function getStatusBackgroundColor(status: TaskStatus): string {
  switch (status) {
    case "ERROR":
    case "MISSING_FILES":
      return "bg-red-50 dark:bg-red-950/20";
      
    case "DOWNLOADING":
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
    case "QUEUED_DOWNLOAD":
    case "FORCED_DOWNLOAD":
      return "bg-green-50 dark:bg-green-950/20";
      
    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
    case "STALLED_DOWNLOAD":
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
    case "STALLED_UPLOAD":
      return "bg-orange-50 dark:bg-orange-950/20";
      
    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
    case "CHECKING_UPLOAD":
      return "bg-cyan-50 dark:bg-cyan-950/20";
      
    case "UPLOADING":
    case "QUEUED_UPLOAD":
    case "FORCED_UPLOAD":
      return "bg-purple-50 dark:bg-purple-950/20";
      
    case "ALLOCATING":
    case "MOVING":
      return "bg-indigo-50 dark:bg-indigo-950/20";
      
    case "UNKNOWN":
    default:
      return "bg-gray-50 dark:bg-gray-950/20";
  }
}

// Left-to-right gradient tinted by status, for strips/headers over a
// thumbnail or background image where a flat bg-* fill would look wrong.
export function getStatusGradientColor(status: TaskStatus): string {
  switch (status) {
    case "ERROR":
    case "MISSING_FILES":
      return "bg-gradient-to-r from-red-500/25 via-red-500/10 to-transparent";

    case "DOWNLOADING":
    case "METADATA_DOWNLOAD":
    case "FORCED_METADATA_DOWNLOAD":
    case "QUEUED_DOWNLOAD":
    case "FORCED_DOWNLOAD":
      return "bg-gradient-to-r from-green-500/25 via-green-500/10 to-transparent";

    case "PAUSED_DOWNLOAD":
    case "STOPPED_DOWNLOAD":
    case "STALLED_DOWNLOAD":
    case "PAUSED_UPLOAD":
    case "STOPPED_UPLOAD":
    case "STALLED_UPLOAD":
      return "bg-gradient-to-r from-orange-500/25 via-orange-500/10 to-transparent";

    case "CHECKING_DOWNLOAD":
    case "CHECKING_RESUME_DATA":
    case "CHECKING_UPLOAD":
      return "bg-gradient-to-r from-cyan-500/25 via-cyan-500/10 to-transparent";

    case "UPLOADING":
    case "QUEUED_UPLOAD":
    case "FORCED_UPLOAD":
      return "bg-gradient-to-r from-purple-500/25 via-purple-500/10 to-transparent";

    case "ALLOCATING":
    case "MOVING":
      return "bg-gradient-to-r from-indigo-500/25 via-indigo-500/10 to-transparent";

    case "UNKNOWN":
    default:
      return "bg-gradient-to-r from-gray-500/20 via-gray-500/5 to-transparent";
  }
}
