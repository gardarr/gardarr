import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/torrent";
import { TorrentLifetimeWidget } from "../TorrentLifetimeWidget";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "en-US" },
  }),
}));

const NOW = new Date("2026-08-20T12:00:00Z");

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    created_at: "2026-08-18T12:00:00Z",
    completed_at: null,
    ...overrides,
  } as Task;
}

describe("TorrentLifetimeWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows only Created and Now points while still downloading", () => {
    const { container } = render(<TorrentLifetimeWidget task={buildTask()} />);

    expect(screen.getByText("torrent.created")).toBeInTheDocument();
    expect(screen.getByText("torrent.now")).toBeInTheDocument();
    expect(screen.queryByText("torrent.completed")).not.toBeInTheDocument();

    // In-progress fill is the animated striped bar, not the solid one.
    expect(container.querySelector(".animate-progress-stripes")).not.toBeNull();

    // No completedAt means the download-duration line is hidden.
    expect(screen.queryByText(/torrent\.download/)).not.toBeInTheDocument();
    expect(screen.getByText(/torrent\.total/)).toBeInTheDocument();
    expect(screen.getByText("2 duration.day")).toBeInTheDocument();
  });

  it("shows all three points and a solid fill once the torrent is complete", () => {
    const { container } = render(
      <TorrentLifetimeWidget
        task={buildTask({ completed_at: "2026-08-19T12:00:00Z" })}
      />
    );

    expect(screen.getByText("torrent.created")).toBeInTheDocument();
    expect(screen.getByText("torrent.completed")).toBeInTheDocument();
    expect(screen.getByText("torrent.now")).toBeInTheDocument();

    expect(container.querySelector(".animate-progress-stripes")).toBeNull();

    expect(screen.getByText(/torrent\.download/)).toBeInTheDocument();
    expect(screen.getByText("1 duration.day")).toBeInTheDocument();
  });

  it("formats a sub-day duration in hours", () => {
    render(
      <TorrentLifetimeWidget
        task={buildTask({ created_at: "2026-08-20T10:00:00Z" })}
      />
    );

    expect(screen.getByText("2 duration.hour")).toBeInTheDocument();
  });

  it("formats a sub-hour duration in minutes", () => {
    render(
      <TorrentLifetimeWidget
        task={buildTask({ created_at: "2026-08-20T11:55:00Z" })}
      />
    );

    expect(screen.getByText("5 duration.minute")).toBeInTheDocument();
  });

  it("formats a sub-minute duration in seconds", () => {
    render(
      <TorrentLifetimeWidget
        task={buildTask({ created_at: "2026-08-20T11:59:50Z" })}
      />
    );

    expect(screen.getByText("10 duration.second")).toBeInTheDocument();
  });
});
