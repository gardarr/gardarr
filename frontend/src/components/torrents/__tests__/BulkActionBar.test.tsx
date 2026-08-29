import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BulkActionBar } from "../BulkActionBar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

describe("BulkActionBar queue priority controls", () => {
  const noop = () => {};

  it("dispatches the right queue action for each button", () => {
    const onAction = vi.fn();
    render(
      <BulkActionBar
        selectedCount={2}
        categories={[]}
        availableTags={[]}
        onAction={onAction}
        onLimits={noop}
        onDelete={noop}
        onClear={noop}
      />
    );

    fireEvent.click(screen.getByLabelText("Move to top of queue"));
    fireEvent.click(screen.getByLabelText("Move up in queue"));
    fireEvent.click(screen.getByLabelText("Move down in queue"));
    fireEvent.click(screen.getByLabelText("Move to bottom of queue"));

    expect(onAction).toHaveBeenNthCalledWith(1, "queue_top");
    expect(onAction).toHaveBeenNthCalledWith(2, "queue_up");
    expect(onAction).toHaveBeenNthCalledWith(3, "queue_down");
    expect(onAction).toHaveBeenNthCalledWith(4, "queue_bottom");
  });

  it("disables queue priority buttons when nothing is selected", () => {
    render(
      <BulkActionBar
        selectedCount={0}
        categories={[]}
        availableTags={[]}
        onAction={vi.fn()}
        onLimits={noop}
        onDelete={noop}
        onClear={noop}
      />
    );

    expect(screen.getByLabelText("Move to top of queue")).toBeDisabled();
  });
});

describe("BulkActionBar queue priority pulse feedback", () => {
  const noop = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pulses the clicked button's icon and clears it after the animation window", () => {
    render(
      <BulkActionBar
        selectedCount={2}
        categories={[]}
        availableTags={[]}
        onAction={vi.fn()}
        onLimits={noop}
        onDelete={noop}
        onClear={noop}
      />
    );

    const bottomButton = screen.getByLabelText("Move to bottom of queue");
    expect(bottomButton.querySelector("svg")?.parentElement).not.toHaveClass("animate-bounce");

    act(() => fireEvent.click(bottomButton));
    expect(bottomButton.querySelector("svg")?.parentElement).toHaveClass("animate-bounce");

    act(() => vi.advanceTimersByTime(600));
    expect(bottomButton.querySelector("svg")?.parentElement).not.toHaveClass("animate-bounce");
  });
});
