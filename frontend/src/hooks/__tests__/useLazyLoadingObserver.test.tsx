import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { useLazyLoadingObserver } from "../useLazyLoadingObserver";

type ObserverCallback = IntersectionObserverCallback;

let observerCallback: ObserverCallback | undefined;
let observerOptions: IntersectionObserverInit | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

class MockIntersectionObserver {
  constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
    observerCallback = callback;
    observerOptions = options;
  }

  observe = observe;
  disconnect = disconnect;
}

function LazyLoadingHarness({ totalItems }: { totalItems: number }) {
  const [displayedItemsCount, setDisplayedItemsCount] = useState(30);
  const [loadedItemsCount, setLoadedItemsCount] = useState(0);
  const [showSentinel, setShowSentinel] = useState(false);

  const sentinelRef = useLazyLoadingObserver({
    enabled: true,
    totalItems: loadedItemsCount,
    displayedItemsCount,
    setDisplayedItemsCount,
    itemsPerLoad: 30,
  });

  return (
    <main style={{ overflowY: "auto", maxHeight: 200 }} data-testid="scroll-container">
      <span data-testid="count">{displayedItemsCount}</span>
      <button
        type="button"
        onClick={() => {
          setLoadedItemsCount(totalItems);
          setShowSentinel(true);
        }}
      >
        mount sentinel
      </button>
      {showSentinel && <div ref={sentinelRef} data-testid="sentinel" />}
    </main>
  );
}

describe("useLazyLoadingObserver", () => {
  beforeEach(() => {
    vi.useRealTimers();
    observerCallback = undefined;
    observerOptions = undefined;
    observe.mockClear();
    disconnect.mockClear();
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("observes a sentinel mounted after initial loading and loads more items", () => {
    render(<LazyLoadingHarness totalItems={75} />);

    expect(observe).not.toHaveBeenCalled();

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    expect(observe).toHaveBeenCalledWith(screen.getByTestId("sentinel"));
    expect(observerOptions?.root).toBe(screen.getByTestId("scroll-container"));

    act(() => {
      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("60");
  });

  it("does not display more than the total item count", () => {
    render(<LazyLoadingHarness totalItems={45} />);

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    act(() => {
      observerCallback?.([
        { isIntersecting: true } as IntersectionObserverEntry,
      ], {} as IntersectionObserver);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("45");
  });

  it("loads every batch while the sentinel keeps intersecting", () => {
    render(<LazyLoadingHarness totalItems={95} />);

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    for (const expectedCount of [60, 90, 95]) {
      act(() => {
        observerCallback?.([
          { isIntersecting: true } as IntersectionObserverEntry,
        ], {} as IntersectionObserver);
      });
      expect(screen.getByTestId("count")).toHaveTextContent(String(expectedCount));
    }
  });

  it("loads more from the scroll container when IntersectionObserver does not fire", () => {
    render(<LazyLoadingHarness totalItems={75} />);

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    const scrollContainer = screen.getByTestId("scroll-container");
    Object.defineProperties(scrollContainer, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 1500 },
      scrollTop: { configurable: true, value: 750 },
    });

    fireEvent.scroll(scrollContainer);

    expect(screen.getByTestId("count")).toHaveTextContent("60");
  });

  it("loads all remaining items even when browser observer events never fire", () => {
    vi.useFakeTimers();
    render(<LazyLoadingHarness totalItems={75} />);

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    const scrollContainer = screen.getByTestId("scroll-container");
    const sentinel = screen.getByTestId("sentinel");
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 200,
    } as DOMRect);
    vi.spyOn(sentinel, "getBoundingClientRect").mockReturnValue({
      top: 180,
      bottom: 196,
    } as DOMRect);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("75");
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it("does not fallback-load repeated batches while the sentinel is off-screen", () => {
    vi.useFakeTimers();
    render(<LazyLoadingHarness totalItems={95} />);

    act(() => {
      screen.getByRole("button", { name: "mount sentinel" }).click();
    });

    const scrollContainer = screen.getByTestId("scroll-container");
    const sentinel = screen.getByTestId("sentinel");
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 200,
    } as DOMRect);
    vi.spyOn(sentinel, "getBoundingClientRect").mockReturnValue({
      top: 1000,
      bottom: 1016,
    } as DOMRect);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByTestId("count")).toHaveTextContent("30");
    expect(observe).toHaveBeenCalledTimes(1);
  });
});
