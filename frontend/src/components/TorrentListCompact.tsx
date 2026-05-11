import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytesPerSecond } from "@/utils/bytes";
import { Download, Upload, Image as ImageIcon } from "lucide-react";
import type { MobileTorrent } from "./TorrentCard";
import { preferencesService } from "@/services/preferences";

interface TorrentListCompactProps {
  torrents: MobileTorrent[];
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
  compact?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestDelete?: (ids: string[]) => void;
}

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
}: Readonly<TorrentListCompactProps>) {
  const [blurIntensity, setBlurIntensity] = useState(50);

  useEffect(() => {
    const prefs = preferencesService.load();
    if (typeof prefs?.background_image_blur_intensity === 'number') {
      setBlurIntensity(prefs.background_image_blur_intensity);
    }
  }, []);

  const handleRowClick = (torrentId: string) => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(torrentId);
    } else {
      onShowDetails(torrentId);
    }
  };

  const pyClass = compact ? 'py-1.5' : 'py-2.5';
  const blurPx = Math.round((blurIntensity / 100) * 24);

  return (
    <div className="w-full space-y-2">
      {torrents.map((torrent) => {
        const hasImage = !!torrent.metadata?.image_url;
        const encodedImageUrl = hasImage && torrent.metadata?.image_url ? encodeURI(torrent.metadata.image_url) : undefined;

        return (
          <TorrentContextMenu
            key={torrent.id}
            taskId={torrent.id}
            workerId={torrent.workerUUID}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onRequestDelete={onRequestDelete}
            onStart={onStart}
            onStop={onStop}
            onRemove={onRemove}
            onForceDownload={onForceDownload}
            onForceReannounce={onForceReannounce}
            onForceRecheck={onForceRecheck}
            onSearchMetadata={onSearchMetadata}
            onLimits={onLimits}
            onShowDetails={onShowDetails}
          >
            <div
              onClick={() => handleRowClick(torrent.id)}
              className={`relative flex flex-col px-4 ${pyClass} rounded-lg border overflow-hidden bg-card hover:brightness-105 transition-all cursor-pointer ${
                selectedIds?.has(torrent.id) ? "ring-2 ring-primary" : ""
              }`}
            >
              {/* Background Image with Blur (only if has image) */}
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
                  {/* Overlay for better readability */}
                  <div className="absolute inset-0 bg-background/80 dark:bg-background/85" />
                </>
              )}

              {/* Content - relative positioning */}
              <div className="relative z-10">
                {/* First row: Thumbnail, Status, Name, and Actions */}
                <div className="flex items-center gap-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-muted flex items-center justify-center">
                    {hasImage ? (
                      <img
                        src={encodedImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  {/* Selection Checkbox */}
                  {selectionMode && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds?.has(torrent.id)}
                        onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
                      />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="flex-shrink-0">
                    <StatusBadge status={torrent.status} size="sm" />
                  </div>

                  {/* Torrent Name - flexible width */}
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {torrent.metadata?.name || torrent.name}
                    </div>
                  </div>

                  {/* Download/Upload speeds - compact */}
                  {(torrent.downloadRateBps > 0 || torrent.uploadRateBps > 0) && (
                    <div className="hidden md:flex flex-shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      {torrent.downloadRateBps > 0 && (
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          <span>{formatBytesPerSecond(torrent.downloadRateBps)}</span>
                        </div>
                      )}
                      {torrent.uploadRateBps > 0 && (
                        <div className="flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          <span>{formatBytesPerSecond(torrent.uploadRateBps)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Worker Icon */}
                  {torrent.workerName && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex-shrink-0 inline-flex items-center justify-center rounded-full border p-1 bg-background/50">
                          <WorkerIcon
                            iconName={torrent.workerIcon}
                            color={torrent.workerColor}
                            size="sm"
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{torrent.workerName}</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Second row: Progress bar only */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 bg-secondary/50 rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${torrent.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-12 text-right font-medium">
                    {torrent.progress.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </TorrentContextMenu>
        );
      })}
    </div>
  );
}

export default TorrentListCompact;
