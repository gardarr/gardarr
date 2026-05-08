import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Worker } from "@/types/worker";
import { WorkerIcon } from "@/components/ui/WorkerIcon";

export function WorkerFilter({
  workers,
  selectedWorkerIds,
  onToggleWorker,
  onSetAll,
}: {
  workers: Worker[];
  selectedWorkerIds: Set<string>;
  onToggleWorker: (id: string) => void;
  onSetAll: (checked: boolean) => void;
}) {
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

  const allSelected = workers.length > 0 && selectedWorkerIds.size === workers.length;
  const someSelected = selectedWorkerIds.size > 0 && !allSelected;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filtrar por worker"
      >
        <span className="truncate">
          {allSelected ? t('torrents.filters.all') : someSelected ? `${selectedWorkerIds.size} worker${selectedWorkerIds.size > 1 ? 's' : ''}` : t('torrents.filters.none')}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div
          className="absolute right-0 mt-1 w-64 rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label="Filtrar por workers"
        >
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            onClick={() => onSetAll(true)}
            role="option"
            aria-selected={allSelected}
          >
            <span className="flex items-center gap-2">
              {t("torrents.filters.allWorkers")}
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          <div className="my-1 h-px bg-border" />
          {workers.map((a) => {
            const selected = selectedWorkerIds.has(a.uuid);
            return (
              <button
                key={a.uuid}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                onClick={() => onToggleWorker(a.uuid)}
                role="option"
                aria-selected={selected}
                title={a.name}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <WorkerIcon
                    iconName={a.icon}
                    color={a.color}
                    size="md"
                    className="w-4 h-4 flex-shrink-0"
                  />
                  <span className="truncate max-w-[140px]">{a.name}</span>
                </div>
                {selected && <span className="text-xs flex-shrink-0">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default WorkerFilter;
