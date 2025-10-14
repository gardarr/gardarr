import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check, Filter } from "lucide-react";

interface ListFilterProps {
  label: string;
  availableItems: string[];
  selectedItems: Set<string>;
  onToggleItem: (item: string) => void;
  onSetAll: (checked: boolean) => void;
}

export function ListFilter({
  label,
  availableItems,
  selectedItems,
  onToggleItem,
  onSetAll,
}: ListFilterProps) {
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

  const allSelected = availableItems.length > 0 && selectedItems.size === availableItems.length;
  const noneSelected = selectedItems.size === 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Filtrar por ${label}`}
      >
        <span className="flex items-center gap-1.5 truncate">
          <Filter className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="truncate">
            {allSelected ? "Todos" : noneSelected ? "Nenhum" : `${selectedItems.size} ${label}`}
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-64 max-h-[400px] overflow-y-auto rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label={`Filtrar por ${label}`}
        >
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground sticky top-0 bg-card border-b z-10"
            onClick={() => onSetAll(true)}
            role="option"
            aria-selected={allSelected}
          >
            <span className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Todos
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          {availableItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum item disponível
            </div>
          ) : (
            availableItems.map((item) => {
              const selected = selectedItems.has(item);
              return (
                <button
                  key={item}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                  onClick={() => onToggleItem(item)}
                  role="option"
                  aria-selected={selected}
                  title={item}
                >
                  <span className="truncate max-w-[220px]">{item || "(sem nome)"}</span>
                  {selected && <Check className="h-4 w-4 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default ListFilter;

