import { useDropdown } from "@/hooks/useDropdown";
import { Button } from "@/components/ui/button";
import { TagBadge } from "@/components/ui/TagBadge";
import { ChevronDown, Check } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { scopeOf } from "@/utils/tagRules";

interface ListFilterProps {
  label: string;
  availableItems: string[];
  selectedItems: Set<string>;
  onToggleItem: (item: string) => void;
  onSetAll: (checked: boolean) => void;
  useTagBadge?: boolean;
  // Splits availableItems into per-scope groups (e.g. every "quality::*"
  // under a "quality" heading) plus a leftover group for plain/grouped
  // tags, instead of one flat list.
  groupByScope?: boolean;
}

function ListFilterOption({
  item,
  selected,
  useTagBadge,
  onToggleItem,
}: {
  item: string;
  selected: boolean;
  useTagBadge: boolean;
  onToggleItem: (item: string) => void;
}) {
  return (
    <button
      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${selected ? 'bg-muted' : ''}`}
      onClick={() => onToggleItem(item)}
      role="option"
      aria-selected={selected}
      title={item}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {useTagBadge ? (
          <TagBadge
            tag={item}
            size="sm"
            showIcon={false}
            className="text-xs"
          />
        ) : (
          <span className="truncate max-w-[220px]">{item || "(sem nome)"}</span>
        )}
      </div>
      {selected && <Check className="h-4 w-4 flex-shrink-0" />}
    </button>
  );
}

export function ListFilter({
  label,
  availableItems,
  selectedItems,
  onToggleItem,
  onSetAll,
  useTagBadge = false,
  groupByScope = false,
}: ListFilterProps) {
  const { t } = useTranslation();
  const { isOpen, setIsOpen, ref: dropdownRef } = useDropdown();

  const { scopedGroups, ungrouped } = useMemo(() => {
    if (!groupByScope) {
      return { scopedGroups: [] as [string, string[]][], ungrouped: availableItems };
    }

    const groups = new Map<string, string[]>();
    const rest: string[] = [];
    for (const item of availableItems) {
      const scope = scopeOf(item);
      if (scope) {
        const group = groups.get(scope) ?? [];
        group.push(item);
        groups.set(scope, group);
      } else {
        rest.push(item);
      }
    }

    return {
      scopedGroups: Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b)),
      ungrouped: rest,
    };
  }, [availableItems, groupByScope]);

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
          {useTagBadge && !allSelected && !noneSelected ? (
            <div className="flex items-center gap-1 flex-wrap max-w-[200px]">
              {Array.from(selectedItems).slice(0, 2).map((item) => (
                <TagBadge
                  key={item}
                  tag={item}
                  size="sm"
                  showIcon={false}
                  className="text-xs"
                />
              ))}
              {selectedItems.size > 2 && (
                <span className="text-xs text-muted-foreground">
                  +{selectedItems.size - 2}
                </span>
              )}
            </div>
          ) : (
            <span className="truncate">
              {allSelected ? t('torrents.filters.all') : noneSelected ? t('torrents.filters.none') : `${selectedItems.size} ${label}`}
            </span>
          )}
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
              {label === "categorias" ? t("torrents.filters.allCategories") : t("torrents.filters.allTags")}
            </span>
            {allSelected && <Check className="h-4 w-4" />}
          </button>
          {availableItems.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum item disponível
            </div>
          ) : scopedGroups.length === 0 ? (
            ungrouped.map((item) => (
              <ListFilterOption
                key={item}
                item={item}
                selected={selectedItems.has(item)}
                useTagBadge={useTagBadge}
                onToggleItem={onToggleItem}
              />
            ))
          ) : (
            <>
              {scopedGroups.map(([scope, items]) => (
                <div key={scope}>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {scope}
                  </div>
                  {items.map((item) => (
                    <ListFilterOption
                      key={item}
                      item={item}
                      selected={selectedItems.has(item)}
                      useTagBadge={useTagBadge}
                      onToggleItem={onToggleItem}
                    />
                  ))}
                </div>
              ))}
              {ungrouped.length > 0 && (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t('torrents.filters.otherTags')}
                  </div>
                  {ungrouped.map((item) => (
                    <ListFilterOption
                      key={item}
                      item={item}
                      selected={selectedItems.has(item)}
                      useTagBadge={useTagBadge}
                      onToggleItem={onToggleItem}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ListFilter;

