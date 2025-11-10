import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, SortAsc, SortDesc, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RatioBadge } from "@/components/RatioBadge";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { type TorrentStatus } from "@/components/TorrentStatusIcon";
import { StatusBadge } from "@/components/StatusBadge";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";
import type { TaskMetadata } from "@/types/torrent";

type SortType = "priority" | "alphabetical" | "size" | "progress" | "download_speed" | "upload_speed" | "downloaded" | "uploaded";

type Torrent = {
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

interface TorrentsTableProps {
  torrents: Torrent[];
  sortType: SortType;
  sortDirection: "asc" | "desc";
  onSortChange: (type: SortType) => void;
  onShowDetails: (id: string) => void;
  currentPage: number;
  totalPages: number;
  filteredTorrentsLength: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
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
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onRequestDelete?: (ids: string[]) => void;
}

function TorrentRow({ torrent, onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck, onMetrics, onLimits, onMetadataUpdate, selectionMode, selected, onToggleSelect, selectedIds, onRequestDelete, compact }: { 
  torrent: Torrent; 
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
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectedIds?: Set<string>;
  onRequestDelete?: (ids: string[]) => void;
  compact?: boolean;
}) {
  const handleRowClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(torrent.id);
    } else {
      onShowDetails(torrent.id);
    }
  };

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
      <tr 
        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={handleRowClick}
      >
      {selectionMode && (
        <td className={`px-3 ${compact ? 'py-1' : 'py-3'}`}>
          <Checkbox
            checked={!!selected}
            onCheckedChange={() => onToggleSelect && onToggleSelect(torrent.id)}
            onClick={(e) => e.stopPropagation()}
            className={compact ? 'h-3.5 w-3.5' : ''}
          />
        </td>
      )}
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'}`}>
        <div className="flex items-center gap-2">
          <StatusBadge 
            status={torrent.status} 
            size={compact ? "sm" : "md"}
          />
          <span 
            className="text-sm font-medium truncate" 
            title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
          >
            {truncateText(torrent.name)}
          </span>
        </div>
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} text-xs text-muted-foreground`}>
        {formatBytes(torrent.totalSizeBytes)}
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-16 bg-secondary rounded-full ${compact ? 'h-1' : 'h-1.5'}`}>
            <div 
              className={`bg-primary ${compact ? 'h-1' : 'h-1.5'} rounded-full transition-all duration-300`} 
              style={{ width: `${torrent.progress}%` }}
            ></div>
          </div>
          <span className="text-xs text-muted-foreground">{torrent.progress.toFixed(0)}%</span>
        </div>
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'}`}>
        <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
          {torrent.downloadRateBps > 0 && (
            <ArrowDown className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-green-600 dark:text-green-400 flex-shrink-0`} />
          )}
          <span className={`${compact ? 'text-xs' : ''} ${torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}`}>
            {formatBytesPerSecond(torrent.downloadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(torrent.downloadedBytes)}
          </span>
        </div>
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'}`}>
        <div className="flex items-center gap-1.5 whitespace-nowrap flex-nowrap">
          {torrent.uploadRateBps > 0 && (
            <ArrowUp className={`${compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} text-purple-600 dark:text-purple-400 flex-shrink-0`} />
          )}
          <span className={`${compact ? 'text-xs' : ''} ${torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}`}>
            {formatBytesPerSecond(torrent.uploadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {formatBytes(torrent.uploadedBytes)}
          </span>
        </div>
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'}`}>
        <RatioBadge ratio={torrent.ratio} showIcon={false} />
      </td>
      <td className={`px-2 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'} w-20`}>
        <SeedersAndPeersBadge 
          seeders={torrent.numSeeds} 
          leechers={torrent.numLeechs} 
        />
      </td>
      <td className={`px-4 ${compact ? 'py-1' : 'py-3'} ${compact ? 'text-xs' : 'text-sm'}`}>
        {torrent.agentName ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center">
                <AgentIcon 
                  iconName={torrent.agentIcon}
                  color={torrent.agentColor}
                  size={compact ? "sm" : "md"}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{torrent.agentName}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className={`${compact ? 'text-xs' : ''} text-muted-foreground`}>—</span>
        )}
      </td>
      </tr>
    </TorrentContextMenu>
  );
}

function SortButton({ 
  sortType: currentSortType, 
  currentSortType: activeSortType,
  currentSortDirection,
  onSort, 
  children 
}: { 
  sortType: SortType; 
  currentSortType: SortType;
  currentSortDirection: "asc" | "desc";
  onSort: (type: SortType) => void; 
  children: React.ReactNode; 
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onSort(currentSortType)}
      className={`h-6 w-6 p-0 hover:bg-muted ${
        activeSortType === currentSortType 
          ? "bg-muted text-foreground" 
          : "text-muted-foreground"
      }`}
      title={`Ordenar por ${children}`}
    >
      {activeSortType === currentSortType ? (
        currentSortDirection === "asc" ? (
          <SortAsc className="h-3 w-3" />
        ) : (
          <SortDesc className="h-3 w-3" />
        )
      ) : (
        <SortAsc className="h-3 w-3 opacity-50" />
      )}
    </Button>
  );
}

export default function TorrentsTable({
  torrents,
  sortType,
  sortDirection,
  onSortChange,
  onShowDetails,
  currentPage,
  totalPages,
  filteredTorrentsLength,
  onPreviousPage,
  onNextPage,
  onStart,
  onStop,
  onRemove,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onMetrics,
  onLimits,
  onMetadataUpdate,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete
}: TorrentsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="hidden md:block">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b bg-muted/50">
                {selectionMode && (
                  <th className={`px-3 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground w-8`}>
                    {/* empty header for checkbox column */}
                  </th>
                )}
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  <div className="flex items-center gap-1">
                    <span>{t('torrents.name')}</span>
                    <SortButton
                      sortType="priority"
                      currentSortType={sortType}
                      currentSortDirection={sortDirection}
                      onSort={onSortChange}
                    >
                      {t('torrents.sortBy.priority')}
                    </SortButton>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  <div className="flex items-center gap-1">
                    <span>{t('torrents.size')}</span>
                    <SortButton
                      sortType="size"
                      currentSortType={sortType}
                      currentSortDirection={sortDirection}
                      onSort={onSortChange}
                    >
                      {t('torrents.sortBy.size')}
                    </SortButton>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  <div className="flex items-center gap-1">
                    <span>{t('torrents.progress')}</span>
                    <SortButton
                      sortType="progress"
                      currentSortType={sortType}
                      currentSortDirection={sortDirection}
                      onSort={onSortChange}
                    >
                      {t('torrents.sortBy.progress')}
                    </SortButton>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  <div className="flex items-center gap-1">
                    <span>{t('torrents.download')}</span>
                    <SortButton
                      sortType="download_speed"
                      currentSortType={sortType}
                      currentSortDirection={sortDirection}
                      onSort={onSortChange}
                    >
                      {t('torrents.sortBy.downloadSpeed')}
                    </SortButton>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  <div className="flex items-center gap-1">
                    <span>{t('torrents.upload')}</span>
                    <SortButton
                      sortType="upload_speed"
                      currentSortType={sortType}
                      currentSortDirection={sortDirection}
                      onSort={onSortChange}
                    >
                      {t('torrents.sortBy.uploadSpeed')}
                    </SortButton>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  {t('torrents.ratio')}
                </th>
                <th className={`px-2 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground w-20`}>
                  <div className="flex items-center gap-1">
                    <span>S/P</span>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  {t('torrents.agent')}
                </th>
              </tr>
            </thead>
            <tbody>
              {torrents.map((t) => (
                <TorrentRow 
                  key={t.id} 
                  torrent={t} 
                  onShowDetails={onShowDetails}
                  onStart={onStart}
                  onStop={onStop}
                  onRemove={onRemove}
                  onForceDownload={onForceDownload}
                  onForceReannounce={onForceReannounce}
                  onForceRecheck={onForceRecheck}
                  onMetrics={onMetrics}
                  onLimits={onLimits}
                  onMetadataUpdate={onMetadataUpdate}
                  selectionMode={selectionMode}
                  selected={!!selectedIds?.has(t.id)}
                  onToggleSelect={onToggleSelect}
                  selectedIds={selectedIds}
                  onRequestDelete={onRequestDelete}
                  compact={compact}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Controles de paginação para desktop */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="text-sm text-muted-foreground">
            {t('torrents.page')} {currentPage} {t('torrents.of')} {totalPages} ({filteredTorrentsLength} {t('torrents.torrents')})
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
              {t('torrents.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={currentPage === totalPages}
            >
              {t('torrents.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
