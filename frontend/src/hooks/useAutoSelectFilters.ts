import { useEffect, useRef } from 'react';

export function useAutoSelectFilters<T>(
    availableItems: T[],
    selectedItems: Set<T>,
    setSelectedItems: (items: Set<T>) => void
) {
    const prevAvailableItemsRef = useRef<T[]>([]);

    useEffect(() => {
        if (availableItems.length === 0) return;

        const prevItems = prevAvailableItemsRef.current;

        // If no items selected yet, select all
        if (selectedItems.size === 0 && prevItems.length === 0) {
            setSelectedItems(new Set(availableItems));
            prevAvailableItemsRef.current = availableItems;
            return;
        }

        // Detect new items
        const newItems = availableItems.filter(i => !prevItems.includes(i));

        // If there are new items AND all previous items were selected,
        // add the new items automatically
        if (newItems.length > 0) {
            const allPreviousSelected = prevItems.every(i => selectedItems.has(i));

            if (allPreviousSelected) {
                setSelectedItems(new Set(availableItems));
            }
        }

        // Update ref
        prevAvailableItemsRef.current = availableItems;
    }, [availableItems, selectedItems, setSelectedItems]);
}
