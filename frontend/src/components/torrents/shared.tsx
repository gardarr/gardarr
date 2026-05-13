import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Image as ImageIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";
import TorrentContextMenu from "./TorrentContextMenu";
import type { TorrentActionHandlers, TorrentListItem, TorrentSelectionProps } from "./types";
import { getTorrentDisplayName, getTorrentImageUrl } from "./helpers";

export function TorrentContextMenuWrapper({
  torrent,
  actions,
  selection,
  children,
}: {
  torrent: TorrentListItem;
  actions: TorrentActionHandlers;
  selection?: TorrentSelectionProps;
  children: ReactNode;
}) {
  return (
    <TorrentContextMenu
      taskId={torrent.id}
      workerId={torrent.workerUUID}
      selectionMode={selection?.selectionMode}
      selectedIds={selection?.selectedIds}
      onRequestDelete={selection?.onRequestDelete}
      onStart={actions.onStart}
      onStop={actions.onStop}
      onRemove={actions.onRemove}
      onForceDownload={actions.onForceDownload}
      onForceReannounce={actions.onForceReannounce}
      onForceRecheck={actions.onForceRecheck}
      onSearchMetadata={actions.onSearchMetadata}
      onLimits={actions.onLimits}
      onShowDetails={actions.onShowDetails}
    >
      {children}
    </TorrentContextMenu>
  );
}

export function TorrentSelectionCheckbox({
  torrentId,
  selected,
  compact,
  onToggleSelect,
}: {
  torrentId: string;
  selected?: boolean;
  compact?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <Checkbox
      checked={!!selected}
      onCheckedChange={() => onToggleSelect?.(torrentId)}
      onClick={(event) => event.stopPropagation()}
      className={compact ? "h-3.5 w-3.5" : undefined}
    />
  );
}

export function TorrentWorkerBadge({
  torrent,
  size = "sm",
  className = "inline-flex items-center justify-center rounded-full border p-1",
  empty,
}: {
  torrent: TorrentListItem;
  size?: "sm" | "md";
  className?: string;
  empty?: ReactNode;
}) {
  if (!torrent.workerName) {
    return empty ?? null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={className}>
          <WorkerIcon
            iconName={torrent.workerIcon}
            color={torrent.workerColor}
            size={size}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{torrent.workerName}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function TorrentProgressBar({
  progress,
  compact,
  showLabel = true,
  labelClassName = "text-xs text-muted-foreground",
}: {
  progress: number;
  compact?: boolean;
  showLabel?: boolean;
  labelClassName?: string;
}) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const heightClass = compact ? "h-1" : "h-1.5";

  return (
    <div className="flex items-center gap-2">
      <div className={`bg-secondary rounded-full ${heightClass} flex-1`}>
        <div
          className={`bg-primary ${heightClass} rounded-full transition-all duration-300`}
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
      {showLabel && (
        <span className={labelClassName}>{progress.toFixed(0)}%</span>
      )}
    </div>
  );
}

export function TorrentDisplayName({
  torrent,
  truncate = true,
  className = "truncate text-sm font-medium",
}: {
  torrent: TorrentListItem;
  truncate?: boolean;
  className?: string;
}) {
  const displayName = getTorrentDisplayName(torrent);

  return (
    <span
      className={className}
      title={isTextTruncated(displayName) ? `${displayName} (truncado)` : displayName}
    >
      {truncate ? truncateText(displayName) : displayName}
    </span>
  );
}

export function TorrentSpeedStat({
  rate,
  total,
  direction,
  compact,
  showWhenIdle = true,
}: {
  rate: number;
  total?: number;
  direction: "download" | "upload";
  compact?: boolean;
  showWhenIdle?: boolean;
}) {
  if (!showWhenIdle && rate <= 0) {
    return null;
  }

  const Icon = direction === "upload" ? ArrowUp : ArrowDown;
  const colorClass = direction === "upload"
    ? "text-purple-600 dark:text-purple-400"
    : "text-green-600 dark:text-green-400";

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
      {rate > 0 && (
        <Icon className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} ${colorClass} flex-shrink-0`} />
      )}
      <span className={`${compact ? "text-xs" : ""} ${rate > 0 ? colorClass : ""}`}>
        {formatBytesPerSecond(rate)}
      </span>
      {total !== undefined && (
        <>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(total)}
          </span>
        </>
      )}
    </div>
  );
}

export function TorrentThumbnail({
  torrent,
  sizeClassName,
  iconClassName,
  roundedClassName = "rounded",
  alt = "",
}: {
  torrent: TorrentListItem;
  sizeClassName: string;
  iconClassName: string;
  roundedClassName?: string;
  alt?: string;
}) {
  const imageUrl = getTorrentImageUrl(torrent);

  return (
    <div className={`flex-shrink-0 ${sizeClassName} ${roundedClassName} overflow-hidden bg-muted flex items-center justify-center`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon className={iconClassName} />
      )}
    </div>
  );
}
