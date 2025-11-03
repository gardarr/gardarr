import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, SortAsc, SortDesc, ArrowUp, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RatioBadge } from "@/components/ui/RatioBadge";
import { AgentIcon } from "@/components/ui/AgentIcon";
import { getStatusIcon, getStatusColor, type TorrentStatus } from "@/components/TorrentStatusIcon";
import TorrentContextMenu from "@/components/TorrentContextMenu";
import { formatBytes, formatBytesPerSecond } from "@/utils/bytes";
import { truncateText, isTextTruncated } from "@/utils/textUtils";

type SortType = "priority" | "alphabetical" | "size" | "progress" | "download_speed" | "upload_speed" | "downloaded" | "uploaded";

type Torrent = {
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
}

function TorrentRow({ torrent, onShowDetails, onStart, onStop, onRemove, onForceDownload, onForceReannounce, onForceRecheck }: { 
  torrent: Torrent; 
  onShowDetails: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRemove: (id: string) => void;
  onForceDownload: (id: string) => void;
  onForceReannounce: (id: string) => void;
  onForceRecheck: (id: string) => void;
}) {
  const StatusIcon = getStatusIcon(torrent.status);

  return (
    <TorrentContextMenu 
      taskId={torrent.id}
      onStart={onStart}
      onStop={onStop}
      onRemove={onRemove}
      onForceDownload={onForceDownload}
      onForceReannounce={onForceReannounce}
      onForceRecheck={onForceRecheck}
    >
      <tr 
        className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
        onClick={() => onShowDetails(torrent.id)}
      >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <StatusIcon 
                className={`h-4 w-4 flex-shrink-0 ${getStatusColor(torrent.status)}`} 
              />
            </TooltipTrigger>
            <TooltipContent>
              <p>{torrent.status}</p>
            </TooltipContent>
          </Tooltip>
          <span 
            className="text-sm font-medium truncate" 
            title={isTextTruncated(torrent.name) ? `${torrent.name} (truncado)` : torrent.name}
          >
            {truncateText(torrent.name)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {formatBytes(torrent.totalSizeBytes)}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-16 bg-secondary rounded-full h-1.5">
            <div 
              className="bg-primary h-1.5 rounded-full transition-all duration-300" 
              style={{ width: `${torrent.progress}%` }}
            ></div>
          </div>
          <span className="text-xs text-muted-foreground">{torrent.progress.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className={torrent.downloadRateBps > 0 ? 'text-green-600 dark:text-green-400' : ''}>
            {formatBytesPerSecond(torrent.downloadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatBytes(torrent.downloadedBytes)})
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className={torrent.uploadRateBps > 0 ? 'text-purple-600 dark:text-purple-400' : ''}>
            {formatBytesPerSecond(torrent.uploadRateBps)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatBytes(torrent.uploadedBytes)})
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <RatioBadge ratio={torrent.ratio} />
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <ArrowUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
            <span className="text-xs">{torrent.numSeeds}</span>
          </div>
          <div className="flex items-center gap-1">
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs">{torrent.numLeechs}</span>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {torrent.agentName ? (
          <div className="flex items-center gap-2">
            <AgentIcon 
              iconName={torrent.agentIcon}
              color={torrent.agentColor}
              size="md"
            />
            <span className="truncate max-w-[160px]" title={torrent.agentName}>{torrent.agentName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
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
  onForceRecheck
}: TorrentsTableProps) {
  const { t } = useTranslation();

  return (
    <div className="hidden md:block">
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  {t('torrents.ratio')}
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span>Seeds/Peers</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
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
