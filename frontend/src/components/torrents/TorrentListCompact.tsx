import { StatusBadge } from "@/components/StatusBadge";
import { getBlurPixels, useTorrentBlurIntensity, useTorrentOpenHandler } from "./hooks";
import {
  TorrentContextMenuWrapper,
  TorrentDisplayName,
  TorrentProgressBar,
  TorrentSelectionCheckbox,
  TorrentSpeedStat,
  TorrentThumbnail,
  TorrentWorkerBadge,
} from "./shared";
import { getTorrentImageUrl } from "./helpers";
import type { TorrentActionHandlers, TorrentListProps, TorrentListItem, TorrentSelectionProps } from "./types";

export function TorrentListCompact({
  torrents,
  onShowDetails,
  onStart,
  onStop,
  onRemove,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onSearchMetadata,
  onLimits,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete,
}: Readonly<TorrentListProps>) {
  const blurIntensity = useTorrentBlurIntensity();
  const pyClass = compact ? 'py-1.5' : 'py-2.5';
  const blurPx = getBlurPixels(blurIntensity);
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
  };
  const selection = { selectionMode, selectedIds, onToggleSelect, onRequestDelete };

  return (
    <div className="w-full space-y-2">
      {torrents.map((torrent) => (
        <TorrentCompactRow
          key={torrent.id}
          torrent={torrent}
          actions={actions}
          selection={selection}
          compact={compact}
          pyClass={pyClass}
          blurPx={blurPx}
        />
      ))}
    </div>
  );
}

export default TorrentListCompact;

function TorrentCompactRow({
  torrent,
  actions,
  selection,
  compact,
  pyClass,
  blurPx,
}: {
  torrent: TorrentListItem;
  actions: TorrentActionHandlers;
  selection: TorrentSelectionProps;
  compact?: boolean;
  pyClass: string;
  blurPx: number;
}) {
  const handleRowClick = useTorrentOpenHandler({
    torrentId: torrent.id,
    selectionMode: selection.selectionMode,
    onToggleSelect: selection.onToggleSelect,
    onShowDetails: actions.onShowDetails,
  });
  const hasImage = !!torrent.metadata?.image_url;
  const encodedImageUrl = getTorrentImageUrl(torrent);

  return (
    <TorrentContextMenuWrapper torrent={torrent} actions={actions} selection={selection}>
      <div
        onClick={handleRowClick}
        className={`relative flex flex-col px-4 ${pyClass} rounded-lg border overflow-hidden bg-card hover:brightness-105 transition-all cursor-pointer ${
          selection.selectedIds?.has(torrent.id) ? "ring-2 ring-primary" : ""
        }`}
      >
        {hasImage && (
          <>
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${encodedImageUrl})`,
                filter: `blur(${blurPx}px)`,
                transform: 'scale(1.1)',
              }}
            />
            <div className="absolute inset-0 bg-background/80 dark:bg-background/85" />
          </>
        )}

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <TorrentThumbnail
              torrent={torrent}
              sizeClassName="w-12 h-12"
              iconClassName="h-6 w-6 text-muted-foreground"
            />

            {selection.selectionMode && (
              <TorrentSelectionCheckbox
                torrentId={torrent.id}
                selected={selection.selectedIds?.has(torrent.id)}
                compact={compact}
                onToggleSelect={selection.onToggleSelect}
              />
            )}

            <div className="flex-shrink-0">
              <StatusBadge status={torrent.status} size="sm" />
            </div>

            <div className="flex-1 min-w-0">
              <TorrentDisplayName torrent={torrent} className="truncate text-sm font-medium" truncate={false} />
            </div>

            {(torrent.downloadRateBps > 0 || torrent.uploadRateBps > 0) && (
              <div className="hidden md:flex flex-shrink-0 items-center gap-2 text-xs text-muted-foreground">
                <TorrentSpeedStat rate={torrent.downloadRateBps} direction="download" compact showWhenIdle={false} />
                <TorrentSpeedStat rate={torrent.uploadRateBps} direction="upload" compact showWhenIdle={false} />
              </div>
            )}

            <TorrentWorkerBadge
              torrent={torrent}
              className="flex-shrink-0 inline-flex items-center justify-center rounded-full border p-1 bg-background/50"
            />
          </div>

          <div className="mt-2">
            <TorrentProgressBar
              progress={torrent.progress}
              labelClassName="text-xs text-muted-foreground w-12 text-right font-medium"
            />
          </div>
        </div>
      </div>
    </TorrentContextMenuWrapper>
  );
}
