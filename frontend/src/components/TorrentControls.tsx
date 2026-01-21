import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Clock, SlidersHorizontal, CheckSquare, Square } from "lucide-react";
import { DropdownSelect } from "@/components/ui/DropdownSelect";
import { useTranslation } from "react-i18next";

interface TorrentControlsProps {
  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  
  // Selection
  selectionMode: boolean;
  allSelected: boolean;
  onToggleSelectAll: () => void;
  
  // Refresh
  refreshIntervalSec: number;
  isRefreshPaused: boolean;
  onRefreshIntervalChange: (value: number) => void;
  
  // Items per page (optional, only for table view)
  itemsPerPage?: number;
  onItemsPerPageChange?: (value: number) => void;
  showItemsPerPage?: boolean;
  
  // Filters
  onOpenFilters: () => void;
  hasActiveFilters: boolean;
  
  // Stats
  filteredCount: number;
  totalCount: number;
  sortType: string;
  sortDirection: "asc" | "desc";
  
  // Loading state
  isLoading: boolean;
  
  // Layout
  isMobile?: boolean;
}

export function TorrentControls({
  searchTerm,
  onSearchChange,
  selectionMode,
  allSelected,
  onToggleSelectAll,
  refreshIntervalSec,
  isRefreshPaused,
  onRefreshIntervalChange,
  itemsPerPage,
  onItemsPerPageChange,
  showItemsPerPage = false,
  onOpenFilters,
  hasActiveFilters,
  filteredCount,
  totalCount,
  sortType,
  sortDirection,
  isLoading,
  isMobile = false,
}: TorrentControlsProps) {
  const { t } = useTranslation();

  const getSortTypeKey = (type: string): string => {
    switch (type) {
      case "priority": return "priority";
      case "alphabetical": return "alphabetical";
      case "size": return "size";
      case "progress": return "progress";
      case "download_speed": return "downloadSpeed";
      case "upload_speed": return "uploadSpeed";
      case "downloaded": return "downloaded";
      case "uploaded": return "uploaded";
      default: return "alphabetical";
    }
  };

  if (isMobile) {
    return (
      <div className="flex items-stretch gap-1.5">
        {/* Select All */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={selectionMode ? "default" : "outline"}
              size="icon"
              className="flex-shrink-0 h-8 w-8"
              onClick={onToggleSelectAll}
              disabled={isLoading}
              aria-label={!selectionMode ? t('torrents.selection.enable') : (!allSelected ? t('torrents.selection.selectAll') : t('torrents.selection.disable'))}
            >
              {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{!selectionMode ? t('torrents.selection.enable') : (!allSelected ? t('torrents.selection.selectAll') : t('torrents.selection.disable'))}</p>
          </TooltipContent>
        </Tooltip>

        {/* Refresh Interval */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <DropdownSelect
            value={isRefreshPaused ? 0 : refreshIntervalSec}
            onChange={onRefreshIntervalChange}
            options={[0, 3, 5, 10, 15, 30, 60]}
            formatLabel={(v) => v === 0 ? t('torrents.refresh.paused') : `${v}s`}
            ariaLabel={isRefreshPaused ? t('torrents.refresh.paused') : `${t('torrents.update')} ${refreshIntervalSec}s`}
            title={isRefreshPaused ? t('torrents.refresh.paused') : t('torrents.updateInterval.title', { seconds: refreshIntervalSec })}
            minWidth="80px"
            disabled={isLoading}
          />
        </div>

        {/* Items per page (optional) */}
        {showItemsPerPage && itemsPerPage && onItemsPerPageChange && (
          <>
            <div className="w-px bg-border self-stretch flex-shrink-0" />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs text-muted-foreground">{t('torrents.itemsPerPage').split(' ')[0]}:</span>
              <DropdownSelect
                value={itemsPerPage}
                onChange={onItemsPerPageChange}
                options={[5, 10, 20, 50, 100]}
                ariaLabel={`Itens por página: ${itemsPerPage}`}
                minWidth="80px"
                disabled={isLoading}
              />
            </div>
            <div className="w-px bg-border self-stretch flex-shrink-0" />
          </>
        )}

        {/* Filters Button */}
        <Button
          variant="outline"
          onClick={onOpenFilters}
          disabled={isLoading}
          className="flex items-center gap-2 flex-1 min-w-0"
        >
          <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
          <span className="text-sm">{t('torrents.filters.title')}</span>
          {hasActiveFilters && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </Button>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="flex items-center gap-4 w-full">
      {/* Select All */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={selectionMode ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={onToggleSelectAll}
            disabled={isLoading}
            aria-label={!selectionMode ? t('torrents.selection.enable') : (!allSelected ? t('torrents.selection.selectAll') : t('torrents.selection.disable'))}
          >
            {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{!selectionMode ? t('torrents.selection.enable') : (!allSelected ? t('torrents.selection.selectAll') : t('torrents.selection.disable'))}</p>
        </TooltipContent>
      </Tooltip>

      {/* Search */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={t('torrents.search')}
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
          disabled={isLoading}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Refresh Interval */}
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <DropdownSelect
            value={isRefreshPaused ? 0 : refreshIntervalSec}
            onChange={onRefreshIntervalChange}
            options={[0, 3, 5, 10, 15, 30, 60]}
            formatLabel={(v) => v === 0 ? t('torrents.refresh.paused') : `${v}s`}
            ariaLabel={isRefreshPaused ? t('torrents.refresh.paused') : `${t('torrents.update')} ${refreshIntervalSec}s`}
            title={isRefreshPaused ? t('torrents.refresh.paused') : t('torrents.updateInterval.title', { seconds: refreshIntervalSec })}
            minWidth="80px"
            disabled={isLoading}
          />
        </div>

        {/* Items per page (optional) */}
        {showItemsPerPage && itemsPerPage && onItemsPerPageChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t('torrents.itemsPerPage')}:</span>
            <DropdownSelect
              value={itemsPerPage}
              onChange={onItemsPerPageChange}
              options={[5, 10, 20, 50, 100]}
              ariaLabel={`Itens por página: ${itemsPerPage}`}
              minWidth="80px"
              disabled={isLoading}
            />
          </div>
        )}

        {/* Filters Button */}
        <Button
          variant="outline"
          onClick={onOpenFilters}
          disabled={isLoading}
          className="flex items-center gap-2 min-w-[120px]"
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="text-sm">{t('torrents.filters.title')}</span>
          {hasActiveFilters && (
            <span className="ml-auto h-2 w-2 rounded-full bg-primary flex-shrink-0" />
          )}
        </Button>

        {/* Stats */}
        <div className="text-sm text-muted-foreground">
          {filteredCount} {t('torrents.of')} {totalCount} {t('torrents.torrents')}
          <span className="ml-2 text-xs">
            ({t('torrents.sortedBy')} {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"})
          </span>
        </div>
      </div>
    </div>
  );
}
