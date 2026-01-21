import { useCallback } from "react";

/**
 * Hook customizado para gerenciar controles de filtro (toggle e setAll)
 * Reduz duplicação de código para múltiplos filtros
 */
export function useFilterControls<T>(
  selectedItems: Set<T>,
  setSelectedItems: React.Dispatch<React.SetStateAction<Set<T>>>,
  availableItems: T[]
) {
  const toggle = useCallback((item: T) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }
      return next;
    });
  }, [setSelectedItems]);

  const setAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(availableItems));
    } else {
      setSelectedItems(new Set());
    }
  }, [setSelectedItems, availableItems]);

  return { toggle, setAll };
}
