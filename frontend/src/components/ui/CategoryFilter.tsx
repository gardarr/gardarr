import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Category } from "@/types/category";

interface CategoryFilterProps {
  readonly categories: Category[];
  readonly selectedCategoryNames: Set<string>;
  readonly onToggleCategory: (name: string) => void;
  readonly onSetAll: (checked: boolean) => void;
}

const ALL_CATEGORIES_VALUE = "__ALL__";

export function CategoryFilter({
  categories,
  selectedCategoryNames,
  onToggleCategory,
  onSetAll,
}: CategoryFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const selectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      selectRef.current?.focus();
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const options = Array.from(event.target.selectedOptions);
    const values = options.map(opt => opt.value);
    
    const hasAll = values.includes(ALL_CATEGORIES_VALUE);
    const currentCategoryNames = new Set(categories.map(cat => cat.name));
    const intersectionSize = [...selectedCategoryNames].filter(name => currentCategoryNames.has(name)).length;
    const wasAllSelected = intersectionSize === currentCategoryNames.size && currentCategoryNames.size > 0;
    
    if (hasAll) {
      // Toggle all selection
      onSetAll(!wasAllSelected);
    } else {
      // Handle individual category selection
      const newSelectedSet = new Set(values);
      const oldSelectedArray = Array.from(selectedCategoryNames).filter(name => currentCategoryNames.has(name));
      
      // Find what changed
      for (const name of categories.map(c => c.name)) {
        const wasSelected = oldSelectedArray.includes(name);
        const isSelected = newSelectedSet.has(name);
        if (wasSelected !== isSelected) {
          onToggleCategory(name);
        }
      }
    }
  };

  const currentCategoryNames = new Set(categories.map(cat => cat.name));
  const intersectionSize = [...selectedCategoryNames].filter(name => currentCategoryNames.has(name)).length;
  const allSelected = intersectionSize === currentCategoryNames.size && currentCategoryNames.size > 0;
  const someSelected = intersectionSize > 0 && intersectionSize < currentCategoryNames.size;

  // Determine button label text
  const getButtonLabel = () => {
    if (allSelected) return t('torrents.filters.all');
    if (someSelected) return `${selectedCategoryNames.size} ${t('torrents.filters.categoriesCount')}`;
    return t('torrents.filters.none');
  };

  const selectedValues = Array.from(selectedCategoryNames).filter(name => 
    categories.some(cat => cat.name === name)
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 min-w-[100px] justify-between text-xs sm:min-w-[140px] sm:text-sm w-full"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label={t('torrents.filters.categories')}
      >
        <span className="truncate">
          {getButtonLabel()}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <select
          ref={selectRef}
          multiple
          size={Math.min(categories.length + 1, 10)}
          value={selectedValues}
          onChange={handleSelectChange}
          className="absolute right-0 mt-1 w-64 rounded-md border bg-card text-card-foreground shadow-md z-[100] text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('torrents.filters.categories')}
        >
          <option value={ALL_CATEGORIES_VALUE} className="px-3 py-2 hover:bg-accent">
            {allSelected ? `✓ ${t("torrents.filters.allCategories")}` : t("torrents.filters.allCategories")}
          </option>
          {categories.length === 0 ? (
            <option disabled className="px-3 py-2 text-muted-foreground">
              {t('torrents.filters.noCategoriesAvailable')}
            </option>
          ) : (
            categories.map((cat) => (
              <option
                key={cat.id}
                value={cat.name}
                className="px-3 py-2 hover:bg-accent"
              >
                {selectedCategoryNames.has(cat.name) ? `✓ ${cat.name}` : cat.name}
              </option>
            ))
          )}
        </select>
      )}
    </div>
  );
}

export default CategoryFilter;
