import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import { RatioBadge } from "@/components/RatioBadge";
import { WorkerIcon } from "@/components/ui/WorkerIcon";
import { getStatusBackgroundColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";
import taskDefaultBg from "@/assets/img/common/task-default-background.png";
import { Download, Upload, Image as ImageIcon, Check, Hourglass } from "lucide-react";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import type { TaskMetadata } from "@/types/torrent";
import { preferencesService } from "@/services/preferences";

// Local minimal type to match TorrentsPage expectations
// Keep in sync with the shape used in Torrents.tsx
export type MobileTorrent = {
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
  workerStatus?: string;
  workerUUID?: string;
  workerIcon?: string;
  workerColor?: string;
  category: string;
  tags: string[];
  metadata?: TaskMetadata | null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TorrentCard({ torrent, onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onLimits, onMetadataUpdate: _onMetadataUpdate, compact, selectionMode, selected, onToggleSelect, selectedIds, onRequestDelete }: Readonly<{
  torrent: MobileTorrent;
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
  onLimits?: (taskId: string, workerId?: string) => void;
  onMetadataUpdate?: () => void;
  compact?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
}>) {
  const [blurIntensity, setBlurIntensity] = useState(50);

  useEffect(() => {
    const prefs = preferencesService.load();
    if (typeof prefs?.background_image_blur_intensity === 'number') {
      setBlurIntensity(prefs.background_image_blur_intensity);
    }
  }, []);

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(torrent.id);
    } else {
      onShowDetails(torrent.id);
    }
  };

  // Convert blur intensity (0-100) to pixels for CSS filter
  // Scale: 0 = 0px, 50 = 12px, 100 = 24px
  const blurPx = Math.round((blurIntensity / 100) * 24);
  const hasImage = !!torrent.metadata?.image_url;
  const encodedImageUrl = hasImage && torrent.metadata?.image_url ? encodeURI(torrent.metadata.image_url) : null;

  return (
    <TorrentContextMenu
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

      onLimits={onLimits}
      onShowDetails={onShowDetails}
    >
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
                  <Checkbox
                    className="h-3.5 w-3.5"
                    checked={!!selected}
                    onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <StatusBadge status={torrent.status} size="sm" showTooltip={false} />
                <CardTitle className="text-[11px] font-medium text-muted-foreground dark:text-gray-400 truncate" title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}>
                  {truncateText(torrent.name)}
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
                <div className="flex-shrink-0">
                  {hasImage ? (
                    <img
                      src={encodedImageUrl!}
                      alt={torrent.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
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
                  <Checkbox
                    checked={!!selected}
                    onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-shrink-0">
                  <StatusBadge status={torrent.status} size="lg" />
                </div>
                <CardTitle
                  className="text-sm font-medium text-muted-foreground dark:text-gray-400 truncate"
                  title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
                >
                  {truncateText(torrent.name)}
                </CardTitle>
              </div>
              {torrent.workerName && (
                <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                  <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center justify-center rounded-full border p-1">
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
                <div className="flex-shrink-0">
                  {hasImage ? (
                    <img
                      src={encodedImageUrl!}
                      alt={torrent.name}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-md bg-muted flex items-center justify-center">
                      <ImageIcon className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                </div>
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
    </TorrentContextMenu>
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
  icon: React.ElementType,
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
