import { useEffect, useState, type Dispatch, type RefCallback, type SetStateAction } from "react";

interface UseLazyLoadingObserverOptions {
  enabled: boolean;
  totalItems: number;
  displayedItemsCount: number;
  setDisplayedItemsCount: Dispatch<SetStateAction<number>>;
  itemsPerLoad: number;
}

export function findScrollContainer(element: HTMLElement): Element | null {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = window.getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
}

/** Observes a lazy-loading sentinel, including when it mounts after initial loading. */
export function useLazyLoadingObserver({
  enabled,
  totalItems,
  displayedItemsCount,
  setDisplayedItemsCount,
  itemsPerLoad,
}: UseLazyLoadingObserverOptions): RefCallback<HTMLDivElement> {
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled || !sentinel || displayedItemsCount >= totalItems) {
      return;
    }

    const scrollContainer = findScrollContainer(sentinel);
    const loadMore = () => {
      setDisplayedItemsCount((currentCount) =>
        Math.min(currentCount + itemsPerLoad, totalItems)
      );
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          return;
        }
        loadMore();
      },
      {
        root: scrollContainer,
        threshold: 0.1,
        rootMargin: "200px",
      }
    );

    observer.observe(sentinel);

    const handleScroll = () => {
      if (!(scrollContainer instanceof HTMLElement)) {
        return;
      }

      const remainingDistance =
        scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight;
      if (remainingDistance <= 200) {
        loadMore();
      }
    };

    scrollContainer?.addEventListener("scroll", handleScroll, { passive: true });

    // Safety fallback: progressive rendering must never depend exclusively on
    // browser intersection/scroll events. Some nested scrolling layouts do
    // not dispatch those events consistently, which previously left the
    // sentinel spinning forever with items still hidden.
    const fallbackTimer = window.setTimeout(loadMore, 250);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, [
    displayedItemsCount,
    enabled,
    itemsPerLoad,
    sentinel,
    setDisplayedItemsCount,
    totalItems,
  ]);

  return setSentinel;
}
