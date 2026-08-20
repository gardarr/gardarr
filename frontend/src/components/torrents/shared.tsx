import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, Clock3, Download, Image as ImageIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { cn } from "@/lib/utils";
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
      canSearchMetadata={torrent.canSearchMetadata}
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
  labelClassName = "text-xs",
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
      <div className={`torrent-progress-track rounded-full ${heightClass} flex-1`}>
        <div
          className={`torrent-progress-fill ${heightClass} rounded-full transition-all duration-300`}
          style={{ width: `${normalizedProgress}%` }}
        />
      </div>
      {showLabel && (
        <TorrentProgressIndicator progress={normalizedProgress} className={labelClassName} />
      )}
    </div>
  );
}

type TorrentProgressState = "pending" | "downloading" | "complete";

type TorrentProgressIndicatorProps = Readonly<{
  progress: number;
  precision?: number;
  variant?: "default" | "opaque";
  className?: string;
  iconClassName?: string;
}>;

const torrentProgressStateConfig = {
  pending: {
    Icon: Clock3,
    colorClass: "text-amber-600 dark:text-amber-400",
  },
  downloading: {
    Icon: Download,
    colorClass: "text-primary",
  },
  complete: {
    Icon: Check,
    colorClass: "text-green-600 dark:text-green-400",
  },
} satisfies Record<TorrentProgressState, { Icon: typeof Check; colorClass: string }>;

function getTorrentProgressState(progress: number): TorrentProgressState {
  if (progress >= 100) {
    return "complete";
  }
  if (progress > 0) {
    return "downloading";
  }
  return "pending";
}

export function TorrentProgressIndicator({
  progress,
  precision = 0,
  variant = "default",
  className,
  iconClassName = "h-3.5 w-3.5",
}: TorrentProgressIndicatorProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));
  const state = getTorrentProgressState(normalizedProgress);
  const { Icon, colorClass: stateColorClass } = torrentProgressStateConfig[state];
  let colorClass = stateColorClass;
  if (variant === "opaque") {
    colorClass = "text-muted-foreground";
  }

  return (
    <span
      className={cn("torrent-progress-indicator inline-flex items-center gap-1 whitespace-nowrap", className, colorClass)}
      data-progress-state={state}
      data-progress-variant={variant}
    >
      <Icon className={cn("shrink-0", iconClassName)} aria-hidden="true" />
      <span>{normalizedProgress.toFixed(precision)}%</span>
    </span>
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
  placeholderIconClassName,
  roundedClassName = "rounded",
  alt = "",
}: {
  torrent: TorrentListItem;
  sizeClassName: string;
  iconClassName: string;
  placeholderIconClassName?: string;
  roundedClassName?: string;
  alt?: string;
}) {
  const imageUrl = getTorrentImageUrl(torrent);

  return (
    <div className={`flex-shrink-0 ${sizeClassName} ${roundedClassName} overflow-hidden bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center`}>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <ImageIcon className={`${iconClassName} ${placeholderIconClassName ?? ""} !text-neutral-500 dark:!text-neutral-400`} />
      )}
    </div>
  );
}

export { TorrentMetadataHoverCard } from "./TorrentMetadataHoverCard";
