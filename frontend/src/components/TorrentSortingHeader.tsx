import { useTranslation } from "react-i18next";

interface TorrentSortingHeaderProps {
  sortType: string;
  sortDirection: "asc" | "desc";
  filteredCount: number;
  totalCount: number;
  isMobile?: boolean;
}

export function TorrentSortingHeader({
  sortType,
  sortDirection,
  filteredCount,
  totalCount,
  isMobile = false,
}: TorrentSortingHeaderProps) {
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

  const textSize = isMobile ? "text-xs" : "text-sm";
  const labelTextSize = isMobile ? "text-xs" : "text-sm";

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className={`${labelTextSize} font-medium text-muted-foreground`}>
            {t('torrents.sortedBy')}:
          </span>
          <span className={`${textSize} text-muted-foreground`}>
            {t(`torrents.sortBy.${getSortTypeKey(sortType)}`)} {sortDirection === "asc" ? "↑" : "↓"}
          </span>
        </div>
        <span className={`${textSize} text-muted-foreground whitespace-nowrap`}>
          {filteredCount} {t('torrents.of')} {totalCount}
        </span>
      </div>
    </div>
  );
}
