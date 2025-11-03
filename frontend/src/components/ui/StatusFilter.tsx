import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import type { TaskStatus } from "@/utils/statusUtils";

// Export TaskStatus as TorrentStatus for backward compatibility
type TorrentStatus = TaskStatus;

interface StatusFilterProps {
  availableStatuses: TorrentStatus[];
  selectedStatuses: Set<TorrentStatus>;
  onToggleStatus: (status: TorrentStatus) => void;
  onSetAll: (checked: boolean) => void;
  getStatusIcon: (status: TorrentStatus) => LucideIcon;
  getStatusColor: (status: TorrentStatus) => string;
}

export function StatusFilter({
  availableStatuses,
  selectedStatuses,
  onToggleStatus,
  onSetAll,
  getStatusIcon,
  getStatusColor,
}: StatusFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const allSelected = availableStatuses.length > 0 && selectedStatuses.size === availableStatuses.length;
  const someSelected = selectedStatuses.size > 0 && !allSelected;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filtrar por status"
      >
        <span className="flex items-center gap-1.5 truncate">
          <span className="truncate">{allSelected ? t('torrents.filters.all') : someSelected ? `${selectedStatuses.size} status` : t('torrents.filters.none')}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-64 max-h-[400px] overflow-y-auto rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label="Filtrar por status"
        >
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground sticky top-0 bg-card border-b z-10"
            onClick={() => onSetAll(true)}
            role="option"
            aria-selected={allSelected}
          >
            <span className="flex items-center gap-2">
              {t("torrents.filters.allStatuses")}
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          {availableStatuses.map((status) => {
            const selected = selectedStatuses.has(status);
            const StatusIcon = getStatusIcon(status);
            return (
              <button
                key={status}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                onClick={() => onToggleStatus(status)}
                role="option"
                aria-selected={selected}
                title={status}
              >
                <span className="flex items-center gap-2">
                  <StatusIcon className={`h-4 w-4 ${getStatusColor(status)}`} />
                  <span className="truncate max-w-[180px]">{status}</span>
                </span>
                {selected && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default StatusFilter;

