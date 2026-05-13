import type { ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RatioBadge } from "@/components/RatioBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import taskDefaultBg from "@/assets/img/common/task-default-background.png";
import { Download, Upload, Check, Hourglass } from "lucide-react";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import { getBlurPixels, useTorrentBlurIntensity, useTorrentOpenHandler } from "./hooks";
import {
  TorrentContextMenuWrapper,
  TorrentDisplayName,
  TorrentSelectionCheckbox,
  TorrentThumbnail,
  TorrentWorkerBadge,
} from "./shared";
import { getTorrentImageUrl } from "./helpers";
import { getStatusBackgroundColor } from "./TorrentStatusIcon";
import type { MobileTorrent, TorrentActionHandlers, TorrentSelectionProps } from "./types";

export type { MobileTorrent };

type TorrentCardProps = TorrentActionHandlers & TorrentSelectionProps & {
  torrent: MobileTorrent;
  compact?: boolean;
  selected?: boolean;
};

export function TorrentCard({
  torrent,
  onShowDetails,
  onStart,
  onStop,
  onRemove,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onSearchMetadata,
  onLimits,
  onMetadataUpdate,
  compact,
  selectionMode,
  selected,
  onToggleSelect,
  selectedIds,
  onRequestDelete,
}: Readonly<TorrentCardProps>) {
  void onMetadataUpdate;
  const blurIntensity = useTorrentBlurIntensity();
  const handleCardClick = useTorrentOpenHandler({
    torrentId: torrent.id,
    selectionMode,
    onToggleSelect,
    onShowDetails,
  });

  const blurPx = getBlurPixels(blurIntensity);
  const hasImage = !!torrent.metadata?.image_url;
  const encodedImageUrl = getTorrentImageUrl(torrent);
  const actions = {
    onShowDetails,
    onStart,
    onStop,
    onRemove,
    onForceDownload,
    onForceReannounce,
    onForceRecheck,
    onSearchMetadata,
    onLimits,
    onMetadataUpdate,
  };
  const selection = { selectionMode, selectedIds, onToggleSelect, onRequestDelete };

  return (
    <TorrentContextMenuWrapper torrent={torrent} actions={actions} selection={selection}>
      <Card
        className="hover:shadow-lg transition-shadow overflow-hidden p-0 gap-2 cursor-pointer relative"
        onClick={handleCardClick}
      >
        {/* Background image for entire card */}
        {hasImage ? (
          <div
            className="absolute inset-0 bg-cover pointer-events-none z-0"
            style={{
              backgroundImage: `url(${encodedImageUrl})`,
              ...(blurPx > 0 && { filter: `blur(${blurPx}px)` }),
              backgroundPosition: `center ${torrent.metadata!.image_position_y ?? 50}%`,
              opacity: Math.max(0.15, Math.min(0.85, (torrent.metadata!.image_opacity ?? 65) / 100))
            }}
            aria-hidden
          />
        ) : (
          <div
            className="absolute inset-0 bg-cover pointer-events-none z-0 opacity-[0.12] dark:opacity-[0.03]"
            style={{ backgroundImage: `url(${taskDefaultBg})` }}
            aria-hidden
          />
        )}

        {compact ? (
          <>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 py-1.5 px-2.5 relative z-10 ${!hasImage ? getStatusBackgroundColor(torrent.status) : ''}`}>
              <BlurOverlay hasImage={hasImage} blurPx={blurPx} opacityClass="bg-white/30" />
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {selectionMode && (
                  <TorrentSelectionCheckbox
                    torrentId={torrent.id}
                    selected={selected}
                    compact
                    onToggleSelect={onToggleSelect}
                  />
                )}
                <StatusBadge status={torrent.status} size="sm" showTooltip={false} />
                <CardTitle className="text-[11px] font-medium text-muted-foreground dark:text-gray-400 truncate">
                  <TorrentDisplayName torrent={torrent} className="truncate" />
                </CardTitle>
              </div>
              {torrent.workerName && (
                <div className="flex-shrink-0 ml-2 inline-flex items-center gap-1">
                  <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />
                </div>
              )}
              {/* Progress bar at bottom of header - hidden when complete */}
              {torrent.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-primary/70 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, torrent.progress))}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pt-0 pb-3 relative z-10">
              <div className="flex gap-2 items-center">
                <TorrentThumbnail
                  torrent={torrent}
                  alt={torrent.name}
                  sizeClassName="w-16 h-16"
                  roundedClassName="rounded-md"
                  iconClassName="h-8 w-8 text-muted-foreground"
                />
                <div className="flex-1 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                  <StatBadge
                    icon={Upload}
                    rate={torrent.uploadRateBps}
                    colorClass="text-purple-600 dark:text-purple-400"
                    hasImage={hasImage}
                    blurPx={blurPx}
                    compact
                  />
                  <StatBadge
                    icon={Download}
                    rate={torrent.downloadRateBps}
                    colorClass="text-green-600 dark:text-green-400"
                    hasImage={hasImage}
                    blurPx={blurPx}
                    compact
                  />
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <ProgressBadge progress={torrent.progress} hasImage={hasImage} blurPx={blurPx} size="text-base" />
                  <SeedersAndPeersBadge seeders={torrent.numSeeds} leechers={torrent.numLeechs} blur={hasImage} blurIntensity={blurIntensity} />
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pt-3 pb-3 px-4 relative z-10 ${!hasImage ? getStatusBackgroundColor(torrent.status) : ''}`}>
              <BlurOverlay hasImage={hasImage} blurPx={blurPx} opacityClass="bg-white/60" />
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {selectionMode && (
                  <TorrentSelectionCheckbox
                    torrentId={torrent.id}
                    selected={selected}
                    onToggleSelect={onToggleSelect}
                  />
                )}
                <div className="flex-shrink-0">
                  <StatusBadge status={torrent.status} size="lg" />
                </div>
                <CardTitle
                  className="text-sm font-medium text-muted-foreground dark:text-gray-400 truncate"
                >
                  <TorrentDisplayName torrent={torrent} className="truncate" />
                </CardTitle>
              </div>
              {torrent.workerName && (
                <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                  <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />
                  <TorrentWorkerBadge torrent={torrent} />
                </div>
              )}
              {/* Progress bar at bottom of header - hidden when complete */}
              {torrent.progress < 100 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40 overflow-hidden">
                  <div
                    className="h-full bg-primary/70 transition-all duration-300 ease-out"
                    style={{ width: `${Math.min(100, Math.max(0, torrent.progress))}%` }}
                  />
                </div>
              )}
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-6 relative z-10">
              <div className="flex gap-3 items-center">
                <TorrentThumbnail
                  torrent={torrent}
                  alt={torrent.name}
                  sizeClassName="w-24 h-24"
                  roundedClassName="rounded-md"
                  iconClassName="h-12 w-12 text-muted-foreground"
                />
                <div className="flex-1 flex flex-col gap-2 text-xs text-muted-foreground">
                  <StatBadge
                    icon={Upload}
                    rate={torrent.uploadRateBps}
                    total={torrent.uploadedBytes}
                    colorClass="text-purple-600 dark:text-purple-400"
                    hasImage={hasImage}
                    blurPx={blurPx}
                  />
                  <StatBadge
                    icon={Download}
                    rate={torrent.downloadRateBps}
                    total={torrent.downloadedBytes}
                    colorClass="text-green-600 dark:text-green-400"
                    hasImage={hasImage}
                    blurPx={blurPx}
                  />
                </div>
                <div className="flex flex-col items-end gap-2 ml-3">
                  <ProgressBadge progress={torrent.progress} hasImage={hasImage} blurPx={blurPx} size="text-lg" />
                  <SeedersAndPeersBadge seeders={torrent.numSeeds} leechers={torrent.numLeechs} blur={hasImage} blurIntensity={blurIntensity} />
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </TorrentContextMenuWrapper>
  );
}

// Helper Components

function BlurOverlay({ hasImage, blurPx, rounded = false, opacityClass = "bg-white/50" }: { hasImage: boolean, blurPx: number, rounded?: boolean, opacityClass?: string }) {
  if (!hasImage) return null;
  return (
    <>
      <div className={`absolute inset-0 bg-background/20 -z-10 ${rounded ? 'rounded-md' : ''}`} style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
      <div className={`absolute inset-0 ${opacityClass} dark:bg-black/40 -z-10 ${rounded ? 'rounded-md' : ''}`} aria-hidden />
    </>
  );
}

function StatBadge({ icon: Icon, rate, total, colorClass, hasImage, blurPx, compact = false }: {
  icon: ElementType,
  rate: number,
  total?: number,
  colorClass: string,
  hasImage: boolean,
  blurPx: number,
  compact?: boolean
}) {
  return (
    <div className={`flex items-center gap-1.5 relative px-2 py-1 w-fit ${compact ? 'px-1.5 py-0.5' : ''}`}>
      <BlurOverlay hasImage={hasImage} blurPx={blurPx} rounded />
      <Icon className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} ${colorClass}`} aria-hidden="true" />
      <span className={rate > 0 ? colorClass : ''}>
        {formatBytesPerSecond(rate)}
      </span>
      {total !== undefined && (
        <>
          <span className="text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(total)}
          </span>
        </>
      )}
    </div>
  );
}

function ProgressBadge({ progress, hasImage, blurPx, size }: { progress: number, hasImage: boolean, blurPx: number, size: string }) {
  const isComplete = progress >= 100;
  return (
    <span className={`${size} text-muted-foreground relative px-2 py-1 flex items-center gap-1`}>
      <BlurOverlay hasImage={hasImage} blurPx={blurPx} rounded />
      {isComplete ? (
        <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
      ) : (
        <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      )}
      {progress.toFixed(0)}%
    </span>
  );
}
