import { useEffect, useRef, useState, type Dispatch, type RefCallback, type SetStateAction } from "react";

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
  const displayedItemsCountRef = useRef(displayedItemsCount);
  displayedItemsCountRef.current = displayedItemsCount;

  useEffect(() => {
    if (!enabled || !sentinel || displayedItemsCountRef.current >= totalItems) {
      return;
    }

    const scrollContainer = findScrollContainer(sentinel);
    const loadMore = () => {
      setDisplayedItemsCount((currentCount) => {
        const nextCount = Math.min(currentCount + itemsPerLoad, totalItems);
        displayedItemsCountRef.current = nextCount;
        return nextCount;
      });
    };
    const isSentinelNearViewport = () => {
      const sentinelRect = sentinel.getBoundingClientRect();
      const preloadMargin = 200;

      if (scrollContainer instanceof HTMLElement) {
        const containerRect = scrollContainer.getBoundingClientRect();
        return sentinelRect.bottom >= containerRect.top - preloadMargin
          && sentinelRect.top <= containerRect.bottom + preloadMargin;
      }

      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      return sentinelRect.bottom >= -preloadMargin
        && sentinelRect.top <= viewportHeight + preloadMargin;
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

    // Safety fallback for nested scrolling layouts that do not reliably emit
    // observer/scroll events. It advances only while the sentinel is actually
    // visible (or inside the same preload margin as IntersectionObserver).
    let fallbackTimer: number | undefined;
    const scheduleFallback = () => {
      fallbackTimer = window.setTimeout(() => {
        if (!isSentinelNearViewport() || displayedItemsCountRef.current >= totalItems) {
          return;
        }

        loadMore();
        scheduleFallback();
      }, 250);
    };
    scheduleFallback();

    return () => {
      if (fallbackTimer !== undefined) {
        window.clearTimeout(fallbackTimer);
      }
      observer.disconnect();
      scrollContainer?.removeEventListener("scroll", handleScroll);
    };
  }, [
    enabled,
    itemsPerLoad,
    sentinel,
    setDisplayedItemsCount,
    totalItems,
  ]);

  return setSentinel;
}
