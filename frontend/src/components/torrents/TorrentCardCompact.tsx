import type { ElementType } from "react";
import { memo, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { RatioBadge } from "@/components/RatioBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { QueueRankBadge } from "@/components/QueueRankBadge";
import { Upload, Download } from "lucide-react";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { getBlurPixels, useTorrentBlurIntensity, useTorrentOpenHandler } from "./hooks";
import {
  TorrentContextMenuWrapper,
  TorrentDisplayName,
  TorrentProgressIndicator,
  TorrentSelectionCheckbox,
  TorrentThumbnail,
  TorrentWorkerBadge,
} from "./shared";
import { getTorrentImageUrl } from "./helpers";
import { getStatusGradientColor } from "./TorrentStatusIcon";
import type { MobileTorrent, TorrentActionHandlers, TorrentSelectionProps } from "./types";

export type { MobileTorrent };

type TorrentCardCompactProps = TorrentActionHandlers & TorrentSelectionProps & {
  torrent: MobileTorrent;
  compact?: boolean;
  selected?: boolean;
};

// Dense grid-card alternative to TorrentCard: thumbnail always sits at the
// left (placeholder icon when there's no cover art), stats sit on their own
// compact rows instead of a large stacked layout.
export const TorrentCardCompact = memo(function TorrentCardCompact({
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
}: Readonly<TorrentCardCompactProps>) {
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

  const actions = useMemo(() => ({
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
  }), [onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onSearchMetadata, onLimits, onMetadataUpdate]);
  const selection = useMemo(
    () => ({ selectionMode, selectedIds, onToggleSelect, onRequestDelete }),
    [selectionMode, selectedIds, onToggleSelect, onRequestDelete]
  );

  return (
    <TorrentContextMenuWrapper torrent={torrent} actions={actions} selection={selection}>
      <Card
        className="hover:shadow-lg hover:outline hover:outline-2 hover:outline-primary/60 hover:shadow-primary/30 transition-shadow overflow-hidden p-0 cursor-pointer relative dark:border-black/80"
        onClick={handleCardClick}
      >
        {hasImage ? (
          <div
            className="absolute inset-0 bg-cover pointer-events-none z-0"
            style={{
              backgroundImage: `url(${encodedImageUrl})`,
              ...(blurPx > 0 && { filter: `blur(${blurPx}px)` }),
              backgroundPosition: `center ${torrent.metadata!.image_position_y ?? 50}%`,
              opacity: Math.max(0.15, Math.min(0.85, (torrent.metadata!.image_brightness ?? 65) / 100)),
            }}
            aria-hidden
          />
        ) : (
          <div
            className="absolute inset-0 pointer-events-none z-0 bg-neutral-200/50 dark:bg-neutral-900/60"
            aria-hidden
          />
        )}
        {hasImage && (
          <div className="absolute inset-0 bg-background/70 dark:bg-background/80 z-0" aria-hidden />
        )}

        {/* Thumbnail fills the entire left side of the card. */}
        <TorrentThumbnail
          torrent={torrent}
          alt={torrent.name}
          sizeClassName={`${compact ? "w-16" : "w-20"} absolute inset-y-0 left-0 z-[5]`}
          roundedClassName="rounded-none"
          iconClassName="h-8 w-8 text-muted-foreground"
          placeholderIconClassName="opacity-40"
        />

        <div className={`relative z-10 flex flex-col gap-1 py-2 pr-2.5 ${compact ? "pl-20" : "pl-24"}`}>
          {/* Line 1: identity - checkbox, status, name, worker.
              Translucent strip behind it for readability over the thumbnail/
              background, plus a status-tinted gradient on top of that. */}
          <div className="relative -ml-4 -mr-2.5 -mt-2 overflow-hidden">
            <div className="absolute inset-0 bg-background/60 dark:bg-black/40 backdrop-blur-sm" aria-hidden />
            <div className={`absolute inset-0 ${getStatusGradientColor(torrent.status)}`} aria-hidden />

            <div className={`relative flex items-center gap-1.5 min-w-0 pl-4 pr-2.5 ${compact ? "py-1" : "py-2"}`}>
              {selectionMode && (
                <TorrentSelectionCheckbox
                  torrentId={torrent.id}
                  selected={selected}
                  compact
                  onToggleSelect={onToggleSelect}
                />
              )}

              <StatusBadge status={torrent.status} size="sm" showTooltip={false} />
              <QueueRankBadge priority={torrent.priority} />

              <TorrentDisplayName
                torrent={torrent}
                className="text-[11px] font-medium text-muted-foreground dark:text-gray-400 truncate flex-1 min-w-0"
              />

              <TorrentWorkerBadge torrent={torrent} className="flex-shrink-0 inline-flex items-center justify-center rounded-full border p-0.5 bg-background/50" />
            </div>

            {torrent.progress < 100 && (
              <div className="torrent-progress-track absolute inset-x-0 bottom-0 z-20 h-[3px] overflow-hidden">
                <div
                  className="torrent-progress-fill h-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, torrent.progress))}%` }}
                />
              </div>
            )}
          </div>

          {/* Line 2: speeds + totals transferred - icon always shown so idle
              torrents (0 B/s) keep the same shape as active ones */}
          <div className={`flex text-[11px] text-muted-foreground ${compact ? "flex-row items-center gap-3" : "flex-col gap-0.5"}`}>
            <SpeedRow icon={Upload} rate={torrent.uploadRateBps} total={torrent.uploadedBytes} colorClass="text-purple-600 dark:text-purple-400" />
            <SpeedRow icon={Download} rate={torrent.downloadRateBps} total={torrent.downloadedBytes} colorClass="text-green-600 dark:text-green-400" />
          </div>

          {/* Line 3: seeders/peers, ratio, progress - wraps instead of clipping on narrow cards */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <SeedersAndPeersBadge seeders={torrent.numSeeds} leechers={torrent.numLeechs} blur={hasImage} blurIntensity={blurIntensity} />

            <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />

            <TorrentProgressIndicator
              progress={torrent.progress}
              variant="opaque"
              className="flex-shrink-0 ml-auto"
              iconClassName="h-3.5 w-3.5"
            />
          </div>
        </div>

      </Card>
    </TorrentContextMenuWrapper>
  );
});

function SpeedRow({ icon: Icon, rate, total, colorClass }: {
  icon: ElementType;
  rate: number;
  total: number;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={`h-3 w-3 flex-shrink-0 ${rate > 0 ? colorClass : ""}`} />
      <span className={rate > 0 ? colorClass : ""}>{formatBytesPerSecond(rate)}</span>
      <span className="text-muted-foreground">•</span>
      <span>{formatBytes(total)}</span>
    </div>
  );
}
