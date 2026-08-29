import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/torrent";
import { TransferStatsCard } from "../TransferStatsCard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    network: {
      download: { amount: 0, speed: 0 },
      upload: { amount: 0, speed: 0 },
    },
    pairs: {
      swarm_seeders: 0,
      swarm_leechers: 0,
      seeders: 0,
      leechers: 0,
    },
    ...overrides,
  } as Task;
}

describe("TransferStatsCard", () => {
  it("shows speed/connected sub-values when present", () => {
    const task = buildTask({
      network: {
        download: { amount: 31_900_000, speed: 4740 },
        upload: { amount: 487_000, speed: 700 },
      },
      pairs: { swarm_seeders: 990, swarm_leechers: 150, seeders: 65, leechers: 18 },
    });

    render(<TransferStatsCard torrent={task} />);

    expect(screen.getByText("990")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("(65)")).toBeInTheDocument();
    expect(screen.getByText("(18)")).toBeInTheDocument();
  });

  it("omits sub-values when speed and connected counts are zero", () => {
    const { container } = render(<TransferStatsCard torrent={buildTask()} />);

    // Values render as "0" for seeders/leechers, but no "(n)" connected
    // sub-label and no speed sub-label should appear anywhere.
    expect(container.textContent).not.toMatch(/\(\d+\)/);
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });

  it("falls back to zero when network/pairs data is missing", () => {
    render(<TransferStatsCard torrent={{} as Task} />);

    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
  });
});
