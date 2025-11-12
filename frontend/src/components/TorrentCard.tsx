import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import { RatioBadge } from "@/components/RatioBadge";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { getStatusBackgroundColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import { StatusBadge } from "@/components/StatusBadge";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";
import taskDefaultBg from "@/assets/img/common/task-default-background.png";
import { Download, Upload } from "lucide-react";
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
  agentName?: string;
  agentStatus?: string;
  agentUUID?: string;
  agentIcon?: string;
  agentColor?: string;
  category: string;
  tags: string[];
  metadata?: TaskMetadata | null;
};

export function TorrentCard({ torrent, onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onMetrics, onLimits, onMetadataUpdate, compact, selectionMode, selected, onToggleSelect, selectedIds, onRequestDelete }: Readonly<{ 
  torrent: MobileTorrent; 
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
  onMetrics?: (taskId: string, agentId?: string) => void;
  onLimits?: (taskId: string, agentId?: string) => void;
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
    if (prefs?.background_image_blur_intensity) {
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

  return (
    <TorrentContextMenu 
      taskId={torrent.id}
      taskHash={torrent.hash}
      taskName={torrent.name}
      agentId={torrent.agentUUID}
      metadata={torrent.metadata}
      selectionMode={selectionMode}
      selectedIds={selectedIds}
      onRequestDelete={onRequestDelete}
      onStart={onStart}
      onStop={onStop}
      onRemove={onRemove}
      onForceDownload={onForceDownload}
      onForceReannounce={onForceReannounce}
      onForceRecheck={onForceRecheck}
      onMetrics={onMetrics}
      onLimits={onLimits}
      onMetadataUpdate={onMetadataUpdate}
    >
      <Card 
        className={`hover:shadow-lg transition-shadow overflow-hidden p-0 gap-2 cursor-pointer relative ${compact ? '' : ''}`}
        onClick={handleCardClick}
      >
        {/* Background image for entire card */}
        {torrent.metadata?.image_url ? (
          <div
            className="absolute inset-0 bg-cover pointer-events-none z-0"
            style={{ 
              backgroundImage: `url(${torrent.metadata.image_url})`,
              ...(blurPx > 0 && { filter: `blur(${blurPx}px)` }),
              backgroundPosition: `center ${torrent.metadata.image_position_y ?? 50}%`,
              opacity: Math.max(0.15, Math.min(0.85, (torrent.metadata.image_opacity ?? 65) / 100))
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1.5 px-2.5 relative z-10">
              {/* Blur overlay for header when custom image exists */}
              {torrent.metadata?.image_url && (
                <>
                  <div className="absolute inset-0 bg-background/20 -z-10" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                  <div className="absolute inset-0 bg-white/30 dark:bg-black/40 -z-10" aria-hidden />
                </>
              )}
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
              {torrent.agentName && (
                <div className="flex-shrink-0 ml-2 inline-flex items-center gap-1">
                  <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pt-0 pb-3 relative z-10">
              <div className="flex gap-2 items-center">
                {torrent.metadata?.image_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={torrent.metadata.image_url}
                      alt={torrent.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-1 relative px-1.5 py-0.5 w-fit">
                    {torrent.metadata?.image_url && (
                      <>
                        <div className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    <Upload className="h-3 w-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
                      {formatBytesPerSecond(torrent.uploadRateBps)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 relative px-1.5 py-0.5 w-fit">
                    {torrent.metadata?.image_url && (
                      <>
                        <div className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    <Download className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                    <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
                      {formatBytesPerSecond(torrent.downloadRateBps)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <span className="text-base text-muted-foreground relative px-2 py-1">
                    {torrent.metadata?.image_url && (
                      <>
                        <span className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <span className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    {torrent.progress.toFixed(0)}%
                  </span>
                  <SeedersAndPeersBadge seeders={torrent.numSeeds} leechers={torrent.numLeechs} blur={!!torrent.metadata?.image_url} blurIntensity={blurIntensity} />
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pt-3 pb-3 px-4 relative z-10 ${!torrent.metadata?.image_url ? getStatusBackgroundColor(torrent.status) : ''}`}>
              {/* Blur overlay for header when custom image exists */}
              {torrent.metadata?.image_url && (
                <>
                  <div className="absolute inset-0 bg-background/20 -z-10" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                  <div className="absolute inset-0 bg-white/60 dark:bg-black/40 -z-10" aria-hidden />
                </>
              )}
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
              {torrent.agentName && (
                <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                  <RatioBadge ratio={torrent.ratio} showValue={false} showIcon={true} />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center justify-center rounded-full border p-1">
                        <AgentIcon 
                          iconName={torrent.agentIcon}
                          color={torrent.agentColor}
                          size="sm"
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{torrent.agentName}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-6 relative z-10">
              <div className="flex gap-3 items-center">
                {torrent.metadata?.image_url && (
                  <div className="flex-shrink-0">
                    <img
                      src={torrent.metadata.image_url}
                      alt={torrent.name}
                      className="w-24 h-24 object-cover rounded-md"
                    />
                  </div>
                )}
                <div className="flex-1 flex flex-col gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 relative px-2 py-1 w-fit">
                    {torrent.metadata?.image_url && (
                      <>
                        <div className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    <Upload className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
                      {formatBytesPerSecond(torrent.uploadRateBps)}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(torrent.uploadedBytes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 relative px-2 py-1 w-fit">
                    {torrent.metadata?.image_url && (
                      <>
                        <div className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <div className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    <Download className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
                    <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
                      {formatBytesPerSecond(torrent.downloadRateBps)}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(torrent.downloadedBytes)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-3">
                  <span className="text-lg text-muted-foreground relative px-2 py-1">
                    {torrent.metadata?.image_url && (
                      <>
                        <span className="absolute inset-0 bg-background/20 -z-10 rounded-md" style={blurPx > 0 ? { backdropFilter: `blur(${blurPx}px)` } : undefined} aria-hidden />
                        <span className="absolute inset-0 bg-white/50 dark:bg-black/40 -z-10 rounded-md" aria-hidden />
                      </>
                    )}
                    {torrent.progress.toFixed(0)}%
                  </span>
                  <SeedersAndPeersBadge seeders={torrent.numSeeds} leechers={torrent.numLeechs} blur={!!torrent.metadata?.image_url} blurIntensity={blurIntensity} />
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </TorrentContextMenu>
  );
}
