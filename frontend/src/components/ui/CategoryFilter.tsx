import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Category } from "@/types/category";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

interface CategoryFilterProps {
  readonly categories: Category[];
  readonly selectedCategoryNames: Set<string>;
  readonly onToggleCategory: (name: string) => void;
  readonly onSetAll: (checked: boolean) => void;
}

export function CategoryFilter({
  categories,
  selectedCategoryNames,
  onToggleCategory,
  onSetAll,
}: CategoryFilterProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const allButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoryRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscapeKey);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isOpen]);

  // Focus the appropriate button when opening or when focusedIndex changes
  useEffect(() => {
    if (!isOpen) return;
    if (focusedIndex === 0) {
      allButtonRef.current?.focus();
    } else {
      const cat = categories[focusedIndex - 1];
      if (cat) {
        categoryRefs.current.get(cat.id)?.focus();
      }
    }
  }, [isOpen, focusedIndex, categories]);

  // Reset focusedIndex when opening
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen]);

  const handleListboxKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const totalItems = categories.length + 1; // +1 for "All" button
    
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % totalItems);
        break;
      case "ArrowUp":
        event.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        break;
      case "Home":
        event.preventDefault();
        setFocusedIndex(0);
        break;
      case "End":
        event.preventDefault();
        setFocusedIndex(categories.length);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (focusedIndex === 0) {
          const currentCategoryNames = new Set(categories.map(cat => cat.name));
          const intersectionSize = [...selectedCategoryNames].filter(name => currentCategoryNames.has(name)).length;
          const allSelected = intersectionSize === currentCategoryNames.size && currentCategoryNames.size > 0;
          onSetAll(!allSelected);
        } else {
          const cat = categories[focusedIndex - 1];
          if (cat) {
            onToggleCategory(cat.name);
          }
        }
        break;
    }
  }, [categories, focusedIndex, selectedCategoryNames, onSetAll, onToggleCategory]);

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
          {getButtonLabel()}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>
      {isOpen && (
        <div 
          className="absolute right-0 mt-1 w-64 max-h-[400px] overflow-y-auto rounded-md border bg-card text-card-foreground shadow-md z-[100] py-1"
          role="listbox"
          tabIndex={0}
          aria-label={t('torrents.filters.categories')}
          aria-activedescendant={focusedIndex === 0 ? 'category-filter-all' : `category-filter-${categories[focusedIndex - 1]?.id}`}
          onKeyDown={handleListboxKeyDown}
        >
          <button
            id="category-filter-all"
            ref={allButtonRef}
            tabIndex={-1}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground sticky top-0 bg-card border-b z-10 ${focusedIndex === 0 ? 'ring-2 ring-ring ring-inset' : ''}`}
            onClick={() => onSetAll(!allSelected)}
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
            categories.map((cat, index) => {
              const selected = selectedCategoryNames.has(cat.name);
              const isFocused = focusedIndex === index + 1;
              return (
                <button
                  id={`category-filter-${cat.id}`}
                  key={cat.id}
                  ref={(el) => {
                    if (el) {
                      categoryRefs.current.set(cat.id, el);
                    } else {
                      categoryRefs.current.delete(cat.id);
                    }
                  }}
                  tabIndex={-1}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''} ${isFocused ? 'ring-2 ring-ring ring-inset' : ''}`}
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
