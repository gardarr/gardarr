import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TorrentMetadataHoverCard } from "@/components/torrents/TorrentMetadataHoverCard";
import type { TorrentListItem } from "@/components/torrents";

const baseTorrent: TorrentListItem = {
  id: "task-1",
  hash: "hash-1",
  name: "Raw Torrent Name",
  totalSizeBytes: 1024,
  downloadRateBps: 0,
  uploadRateBps: 0,
  downloadedBytes: 0,
  uploadedBytes: 0,
  status: "DOWNLOADING",
  createdAt: "2026-05-13T00:00:00Z",
  progress: 50,
  ratio: 1.2,
  numSeeds: 5,
  numLeechs: 2,
  category: "movies",
  tags: [],
  metadata: {
    uuid: "meta-1",
    task_hash: "hash-1",
    image_url: "https://example.com/cover.jpg",
    name: "Friendly Title",
    description: "A longer description for the hover preview.",
    created_at: "2026-05-13T00:00:00Z",
    updated_at: "2026-05-13T00:00:00Z",
  },
};

describe("TorrentMetadataHoverCard", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  it("renders hover preview when metadata exists", async () => {
    const user = userEvent.setup();

    render(
      <TorrentMetadataHoverCard torrent={baseTorrent}>
        <button type="button">Task trigger</button>
      </TorrentMetadataHoverCard>
    );

    await user.hover(screen.getByRole("button", { name: "Task trigger" }));

    await waitFor(() => {
      expect(screen.getByText("Friendly Title")).toBeInTheDocument();
    });

    expect(screen.getByText("A longer description for the hover preview.")).toBeInTheDocument();
    expect(screen.getByAltText("Friendly Title")).toHaveAttribute("src", "https://example.com/cover.jpg");
  });

  it("shows placeholder image and keeps description clamped when image is missing", async () => {
    const user = userEvent.setup();
    const torrentWithoutImage: TorrentListItem = {
      ...baseTorrent,
      metadata: {
        ...baseTorrent.metadata!,
        image_url: undefined,
      },
    };

    render(
      <TorrentMetadataHoverCard torrent={torrentWithoutImage}>
        <button type="button">Task trigger</button>
      </TorrentMetadataHoverCard>
    );

    await user.hover(screen.getByRole("button", { name: "Task trigger" }));

    const description = await screen.findByText("A longer description for the hover preview.");
    expect(screen.queryByRole("img", { name: "Friendly Title" })).not.toBeInTheDocument();
    expect(description).toHaveClass("line-clamp-2");
  });

  it("does not render hover preview when metadata is absent", () => {
    const torrentWithoutMetadata: TorrentListItem = {
      ...baseTorrent,
      metadata: null,
    };

    render(
      <TorrentMetadataHoverCard torrent={torrentWithoutMetadata}>
        <button type="button">Task trigger</button>
      </TorrentMetadataHoverCard>
    );

    expect(screen.queryByText("A longer description for the hover preview.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Task trigger" })).toBeInTheDocument();
  });

  it("forwards context-menu handlers to the real trigger element", async () => {
    const user = userEvent.setup();
    const onContextMenu = vi.fn();

    render(
      <TorrentMetadataHoverCard torrent={baseTorrent} onContextMenu={onContextMenu}>
        <button type="button">Task trigger</button>
      </TorrentMetadataHoverCard>
    );

    await user.pointer([
      { target: screen.getByRole("button", { name: "Task trigger" }), keys: "[MouseRight]" },
    ]);

    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });

  it("forwards context-menu handlers even when metadata is absent", async () => {
    const user = userEvent.setup();
    const onContextMenu = vi.fn();
    const torrentWithoutMetadata: TorrentListItem = {
      ...baseTorrent,
      metadata: null,
    };

    render(
      <TorrentMetadataHoverCard torrent={torrentWithoutMetadata} onContextMenu={onContextMenu}>
        <button type="button">Task trigger</button>
      </TorrentMetadataHoverCard>
    );

    await user.pointer([
      { target: screen.getByRole("button", { name: "Task trigger" }), keys: "[MouseRight]" },
    ]);

    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});

vi.mock("@/components/StatusBadge", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/WorkerIcon", () => ({
  WorkerIcon: () => <span>worker-icon</span>,
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({ onClick }: { onClick?: (event: { stopPropagation: () => void }) => void }) => (
    <button
      type="button"
      onClick={() => onClick?.({ stopPropagation: () => undefined })}
    >
      checkbox
    </button>
  ),
}));

vi.mock("@/components/torrents/TorrentContextMenu", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

it("keeps row click behavior intact in compact list", async () => {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: true,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });

  const user = userEvent.setup();
  const { default: TorrentListCompact } = await import("@/components/torrents/TorrentListCompact");
  const onShowDetails = vi.fn();

  render(
    <TorrentListCompact
      torrents={[baseTorrent]}
      onShowDetails={onShowDetails}
      onStart={() => undefined}
      onStop={() => undefined}
      onRemove={() => undefined}
      onForceDownload={() => undefined}
      onForceReannounce={() => undefined}
      onForceRecheck={() => undefined}
      onRequestDelete={() => undefined}
    />
  );

  await user.click(screen.getAllByText("Friendly Title")[0]);

  expect(onShowDetails).toHaveBeenCalledWith("task-1");
});
