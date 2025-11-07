import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressBar } from "@/components/ui/ProgressBar";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import { RatioBadge } from "@/components/RatioBadge";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { getStatusIcon, getStatusColor, getStatusBackgroundColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";
import taskDefaultBg from "@/assets/img/common/task-default-background.png";
import { ArrowDown, ArrowUp, Download, Upload } from "lucide-react";

// Local minimal type to match TorrentsPage expectations
// Keep in sync with the shape used in Torrents.tsx
export type MobileTorrent = {
  id: string;
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
};

function TorrentCard({ torrent, onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onMetrics, onLimits, compact, selectionMode, selected, onToggleSelect, selectedIds, onRequestDelete }: Readonly<{ 
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
  compact?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
}>) {
  const StatusIcon = getStatusIcon(torrent.status);

  const handleCardClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(torrent.id);
    } else {
      onShowDetails(torrent.id);
    }
  };

  return (
    <TorrentContextMenu 
      taskId={torrent.id}
      agentId={torrent.agentUUID}
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
    >
      <Card 
        className={`hover:shadow-lg transition-shadow overflow-hidden p-0 gap-2 cursor-pointer relative ${compact ? '' : ''}`}
        onClick={handleCardClick}
      >
        {compact ? (
          <>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-1.5 px-2.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {selectionMode && (
                  <Checkbox
                    className="h-3.5 w-3.5"
                    checked={!!selected}
                    onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <StatusIcon className={`h-3 w-3 flex-shrink-0 ${getStatusColor(torrent.status)}`} />
                <CardTitle className="text-[11px] font-medium text-muted-foreground truncate" title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}>
                  {truncateText(torrent.name)}
                </CardTitle>
              </div>
              {torrent.agentName && (
                <div className="flex-shrink-0 ml-2 inline-flex items-center gap-1">
                  <RatioBadge ratio={torrent.ratio} showValue={false} />
                </div>
              )}
            </CardHeader>
            <CardContent className="px-3 pt-0 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <ProgressBar progress={torrent.progress} height="sm" className="mb-0 opacity-70" showLabel={false} />
                </div>
                <span className="text-[10px] text-muted-foreground">{torrent.progress.toFixed(0)}%</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Download className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden="true" />
                    <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
                      {formatBytesPerSecond(torrent.downloadRateBps)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Upload className="h-3 w-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
                      {formatBytesPerSecond(torrent.uploadRateBps)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <ArrowUp className="h-3 w-3 text-green-600 dark:text-green-400" />
                    <span className="text-[11px]">{torrent.numSeeds}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ArrowDown className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-[11px]">{torrent.numLeechs}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className={`flex flex-row items-center justify-between space-y-0 pt-3 pb-3 px-4 ${getStatusBackgroundColor(torrent.status)}`}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {selectionMode && (
                  <Checkbox
                    checked={!!selected}
                    onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <StatusIcon 
                        className={`h-5 w-5 ${getStatusColor(torrent.status)}`} 
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{torrent.status}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <CardTitle 
                  className="text-sm font-medium text-muted-foreground truncate" 
                  title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
                >
                  {truncateText(torrent.name)}
                </CardTitle>
              </div>
              {torrent.agentName && (
                <div className="flex-shrink-0 ml-2 flex items-center gap-2">
                  <RatioBadge ratio={torrent.ratio} showValue={false} />
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
            <CardContent className="px-4 pt-1 pb-6 relative">
              {/* Background image only for the body (not header), very low opacity */}
              <div
                className="absolute inset-0 bg-center bg-cover pointer-events-none opacity-[0.12] dark:opacity-[0.03]"
                style={{ backgroundImage: `url(${taskDefaultBg})` }}
                aria-hidden
              />
              <div className="flex items-center gap-2 mt-0 mb-3">
                <div className="flex-1">
                  <ProgressBar progress={torrent.progress} height="md" className="mb-0 opacity-60" showLabel={false} />
                </div>
                <span className="text-xs text-muted-foreground">{torrent.progress.toFixed(0)}%</span>
              </div>
              <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Download className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden="true" />
                  <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
                    {formatBytesPerSecond(torrent.downloadRateBps)}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground">
                    {formatBytes(torrent.downloadedBytes)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                    <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
                      {formatBytesPerSecond(torrent.uploadRateBps)}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(torrent.uploadedBytes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <ArrowUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      <span className="text-xs">{torrent.numSeeds}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs">{torrent.numLeechs}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </TorrentContextMenu>
  );
}

export default function TorrentListMobile({
  torrents,
  onShowDetails,
  onStart,
  onStop,
  onRemove,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onMetrics,
  onLimits,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete,
}: Readonly<{
  torrents: MobileTorrent[];
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
  onMetrics?: (taskId: string, agentId?: string) => void;
  onLimits?: (taskId: string, agentId?: string) => void;
  compact?: boolean;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestDelete?: (ids: string[]) => void;
}>) {
  return (
    <div className={`${compact ? 'space-y-2' : 'space-y-4'} w-full`}>
      {torrents.map((t) => (
        <TorrentCard
          key={t.id}
          torrent={t}
          onShowDetails={onShowDetails}
          onStart={onStart}
          onStop={onStop}
          onMetrics={onMetrics}
          onRemove={onRemove}
          onForceDownload={onForceDownload}
          onForceReannounce={onForceReannounce}
          onForceRecheck={onForceRecheck}
          onLimits={onLimits}
          compact={compact}
          selectionMode={selectionMode}
          selected={!!selectedIds?.has(t.id)}
          onToggleSelect={onToggleSelect}
          selectedIds={selectedIds}
          onRequestDelete={onRequestDelete}
        />
      ))}
    </div>
  );
}
