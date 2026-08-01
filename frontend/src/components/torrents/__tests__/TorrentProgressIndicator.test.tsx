import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TorrentProgressIndicator } from "../shared";

describe("TorrentProgressIndicator", () => {
  it.each([
    { progress: 0, state: "pending", icon: "lucide-clock-3", label: "0%" },
    { progress: 42, state: "downloading", icon: "lucide-download", label: "42%" },
    { progress: 100, state: "complete", icon: "lucide-check", label: "100%" },
  ])("renders the $state state", ({ progress, state, icon, label }) => {
    const { container } = render(<TorrentProgressIndicator progress={progress} />);
    const indicator = screen.getByText(label).parentElement;

    expect(indicator).toHaveAttribute("data-progress-state", state);
    expect(indicator).toHaveClass("torrent-progress-indicator");
    expect(container.querySelector(`.${icon}`)).toBeInTheDocument();
  });

  it("clamps values and respects decimal precision", () => {
    const { rerender } = render(<TorrentProgressIndicator progress={123} precision={1} />);
    expect(screen.getByText("100.0%")).toBeInTheDocument();

    rerender(<TorrentProgressIndicator progress={-5} precision={1} />);
    expect(screen.getByText("0.0%")).toBeInTheDocument();
  });

  it("renders the opaque variant without status coloring", () => {
    const { rerender } = render(<TorrentProgressIndicator progress={0} variant="opaque" />);
    const pendingIndicator = screen.getByText("0%").parentElement;

    expect(pendingIndicator).toHaveAttribute("data-progress-variant", "opaque");
    expect(pendingIndicator).toHaveClass("text-muted-foreground");
    expect(pendingIndicator).not.toHaveClass("text-amber-600");

    rerender(<TorrentProgressIndicator progress={100} variant="opaque" />);
    const completeIndicator = screen.getByText("100%").parentElement;

    expect(completeIndicator).toHaveClass("text-muted-foreground");
    expect(completeIndicator).not.toHaveClass("text-green-600");
  });
});
