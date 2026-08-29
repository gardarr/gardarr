import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useActionPulse } from "../useActionPulse";

describe("useActionPulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sets pulsedAction on trigger and clears it after durationMs", () => {
    const { result } = renderHook(() => useActionPulse<"top" | "down">(600));

    expect(result.current.pulsedAction).toBeNull();

    act(() => result.current.trigger("top"));
    expect(result.current.pulsedAction).toBe("top");

    act(() => vi.advanceTimersByTime(599));
    expect(result.current.pulsedAction).toBe("top");

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.pulsedAction).toBeNull();
  });

  it("restarts the timer and changes the token on a repeated trigger before it expires", () => {
    const { result } = renderHook(() => useActionPulse<"top" | "down">(600));

    act(() => result.current.trigger("top"));
    const firstToken = result.current.pulseToken;

    act(() => vi.advanceTimersByTime(400));
    act(() => result.current.trigger("top"));
    const secondToken = result.current.pulseToken;

    expect(secondToken).not.toBe(firstToken);

    // Original timeout (would've fired at 600ms from the first trigger,
    // i.e. 200ms from here) must have been cleared by the second trigger.
    act(() => vi.advanceTimersByTime(200));
    expect(result.current.pulsedAction).toBe("top");

    act(() => vi.advanceTimersByTime(400));
    expect(result.current.pulsedAction).toBeNull();
  });

  it("switching to a different action updates pulsedAction immediately", () => {
    const { result } = renderHook(() => useActionPulse<"top" | "down">(600));

    act(() => result.current.trigger("top"));
    expect(result.current.pulsedAction).toBe("top");

    act(() => result.current.trigger("down"));
    expect(result.current.pulsedAction).toBe("down");
  });
});
