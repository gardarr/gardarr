import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Category } from "@/types/category";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

interface CategoryFilterProps {
  categories: Category[];
  selectedCategoryNames: Set<string>;
  onToggleCategory: (name: string) => void;
  onSetAll: (checked: boolean) => void;
}

export function CategoryFilter({
  categories,
  selectedCategoryNames,
  onToggleCategory,
  onSetAll,
}: CategoryFilterProps) {
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

  const allSelected = categories.length > 0 && selectedCategoryNames.size === categories.length;
  const someSelected = selectedCategoryNames.size > 0 && !allSelected;

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t('torrents.filters.categories')}
      >
        <span className="truncate">
          {allSelected ? t('torrents.filters.all') : someSelected ? `${selectedCategoryNames.size} ${t('torrents.filters.categoriesCount')}` : t('torrents.filters.none')}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-64 max-h-[400px] overflow-y-auto rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          aria-label={t('torrents.filters.categories')}
        >
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground sticky top-0 bg-card border-b z-10"
            onClick={() => onSetAll(true)}
            role="option"
            aria-selected={allSelected}
          >
            <span className="flex items-center gap-2">
              {t("torrents.filters.allCategories")}
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          {categories.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {t('torrents.filters.noCategoriesAvailable')}
            </div>
          ) : (
            categories.map((cat) => {
              const selected = selectedCategoryNames.has(cat.name);
              return (
                <button
                  key={cat.id}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
                  onClick={() => onToggleCategory(cat.name)}
                  role="option"
                  aria-selected={selected}
                  title={cat.name}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <CategoryIcon 
                      iconName={cat.icon}
                      color={cat.color}
                      size="md"
                      className="flex-shrink-0"
                    />
                    <span className="truncate max-w-[140px]">{cat.name}</span>
                  </div>
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

export default CategoryFilter;
