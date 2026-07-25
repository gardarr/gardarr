import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, SortAsc, SortDesc } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RatioBadge } from "@/components/RatioBadge";
import { StatusBadge } from "@/components/StatusBadge";
import SeedersAndPeersBadge from "@/components/SeedersAndPeersBadge";
import { formatBytes } from "@/utils/bytes";
import { useTorrentOpenHandler } from "./hooks";
import {
  TorrentContextMenuWrapper,
  TorrentDisplayName,
  TorrentMetadataHoverCard,
  TorrentProgressBar,
  TorrentSelectionCheckbox,
  TorrentSpeedStat,
  TorrentWorkerBadge,
} from "./shared";
import type {
  SortType,
  TorrentActionHandlers,
  TorrentListDisplayProps,
  TorrentListItem,
  TorrentPaginationProps,
  TorrentSelectionProps,
} from "./types";

interface TorrentsTableProps extends TorrentListDisplayProps, TorrentActionHandlers, TorrentSelectionProps, TorrentPaginationProps {
  sortType: SortType;
  sortDirection: "asc" | "desc";
  onSortChange: (type: SortType) => void;
}

const TorrentRow = memo(function TorrentRow({ torrent, actions, selection, selected, compact }: {
  torrent: TorrentListItem;
  actions: TorrentActionHandlers;
  selection: TorrentSelectionProps;
  selected?: boolean;
  compact?: boolean;
}) {
  const handleRowClick = useTorrentOpenHandler({
    torrentId: torrent.id,
    selectionMode: selection.selectionMode,
    onToggleSelect: selection.onToggleSelect,
    onShowDetails: actions.onShowDetails,
  });

  const pyClass = compact ? 'py-1' : 'py-3';
  const textSizeClass = compact ? 'text-xs' : 'text-sm';
  const cellClass = `px-4 ${pyClass} ${textSizeClass}`;

  return (
    <TorrentContextMenuWrapper torrent={torrent} actions={actions} selection={selection}>
      <TorrentMetadataHoverCard torrent={torrent}>
        <tr
          className="border-b hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={handleRowClick}
        >
          {selection.selectionMode && (
            <td className={`px-3 ${pyClass}`}>
              <TorrentSelectionCheckbox
                torrentId={torrent.id}
                selected={selected}
                compact={compact}
                onToggleSelect={selection.onToggleSelect}
              />
            </td>
          )}
          <td className={`px-4 ${pyClass}`}>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={torrent.status}
                size={compact ? "sm" : "md"}
              />
              <TorrentDisplayName torrent={torrent} />
            </div>
          </td>
          <td className={`px-4 ${pyClass} text-xs text-muted-foreground`}>
            {formatBytes(torrent.totalSizeBytes)}
          </td>
          <td className={cellClass}>
            <TorrentProgressBar progress={torrent.progress} compact={compact} />
          </td>
          <td className={cellClass}>
            <TorrentSpeedStat rate={torrent.downloadRateBps} total={torrent.downloadedBytes} direction="download" compact={compact} />
          </td>
          <td className={cellClass}>
            <TorrentSpeedStat rate={torrent.uploadRateBps} total={torrent.uploadedBytes} direction="upload" compact={compact} />
          </td>
          <td className={cellClass}>
            <RatioBadge ratio={torrent.ratio} showIcon={false} />
          </td>
          <td className={`px-2 ${pyClass} ${textSizeClass} w-20`}>
            <SeedersAndPeersBadge
              seeders={torrent.numSeeds}
              leechers={torrent.numLeechs}
            />
          </td>
          <td className={cellClass}>
            <TorrentWorkerBadge
              torrent={torrent}
              size={compact ? "sm" : "md"}
              className="flex items-center justify-center"
              empty={<span className={`${compact ? 'text-xs' : ''} text-muted-foreground`}>-</span>}
            />
          </td>
        </tr>
      </TorrentMetadataHoverCard>
    </TorrentContextMenuWrapper>
  );
});

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
      className={`h-6 w-6 p-0 hover:bg-muted ${activeSortType === currentSortType
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

function SortableColumnHeader({
  sortType,
  currentSortType,
  currentSortDirection,
  onSortChange,
  label,
  compact
}: {
  sortType: SortType;
  currentSortType: SortType;
  currentSortDirection: "asc" | "desc";
  onSortChange: (type: SortType) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
      <div className="flex items-center gap-1">
        <span>{label}</span>
        <SortButton
          sortType={sortType}
          currentSortType={currentSortType}
          currentSortDirection={currentSortDirection}
          onSort={onSortChange}
        >
          {label}
        </SortButton>
      </div>
    </th>
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
  onSearchMetadata,
  onLimits,
  onMetadataUpdate,
  compact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onRequestDelete
}: TorrentsTableProps) {
  const { t } = useTranslation();
  // Memoized so TorrentRow (React.memo) only sees a new actions/selection
  // reference when one of these actually changes, instead of on every
  // TorrentsTable render (e.g. sort/pagination chrome updates).
  const actions = useMemo<TorrentActionHandlers>(() => ({
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
  const selection = useMemo<TorrentSelectionProps>(
    () => ({ selectionMode, selectedIds, onToggleSelect, onRequestDelete }),
    [selectionMode, selectedIds, onToggleSelect, onRequestDelete]
  );

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
                <SortableColumnHeader
                  sortType="priority"
                  currentSortType={sortType}
                  currentSortDirection={sortDirection}
                  onSortChange={onSortChange}
                  label={t('torrents.name')}
                  compact={compact}
                />
                <SortableColumnHeader
                  sortType="size"
                  currentSortType={sortType}
                  currentSortDirection={sortDirection}
                  onSortChange={onSortChange}
                  label={t('torrents.size')}
                  compact={compact}
                />
                <SortableColumnHeader
                  sortType="progress"
                  currentSortType={sortType}
                  currentSortDirection={sortDirection}
                  onSortChange={onSortChange}
                  label={t('torrents.progress')}
                  compact={compact}
                />
                <SortableColumnHeader
                  sortType="download_speed"
                  currentSortType={sortType}
                  currentSortDirection={sortDirection}
                  onSortChange={onSortChange}
                  label={t('torrents.download')}
                  compact={compact}
                />
                <SortableColumnHeader
                  sortType="upload_speed"
                  currentSortType={sortType}
                  currentSortDirection={sortDirection}
                  onSortChange={onSortChange}
                  label={t('torrents.upload')}
                  compact={compact}
                />
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  {t('torrents.ratio')}
                </th>
                <th className={`px-2 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground w-20`}>
                  <div className="flex items-center gap-1">
                    <span>S/P</span>
                  </div>
                </th>
                <th className={`px-4 ${compact ? 'py-1' : 'py-3'} text-left text-sm font-medium text-muted-foreground`}>
                  {t('torrents.worker')}
                </th>
              </tr>
            </thead>
            <tbody>
              {torrents.map((t) => (
                <TorrentRow
                  key={t.id}
                  torrent={t}
                  actions={actions}
                  selection={selection}
                  selected={!!selectedIds?.has(t.id)}
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
