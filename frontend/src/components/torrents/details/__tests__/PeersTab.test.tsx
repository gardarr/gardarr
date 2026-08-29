import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { PeersTab } from "../PeersTab";
import type { Task, TaskPeer } from "@/types/torrent";

const listTaskPeers = vi.fn();
const banPeer = vi.fn();
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock("@/services/torrents", () => ({
  torrentService: {
    listTaskPeers: (...args: unknown[]) => listTaskPeers(...args),
    banPeer: (...args: unknown[]) => banPeer(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const baseTorrent = {
  id: "task-1",
  hash: "task-1",
  worker: { uuid: "worker-1" },
} as unknown as Task;

const makePeers = (): TaskPeer[] => [
  {
    ip: "203.0.113.5",
    port: 51413,
    client: "qBittorrent/4.6.0",
    flags: "D",
    flags_desc: "Interested, downloading",
    connection: "BT",
    country: "Brazil",
    country_code: "BR",
    downloaded: 1024,
    dl_speed: 512,
    progress: 0.5,
    uploaded: 2048,
    up_speed: 256,
    relevance: 0,
  },
];

const makePeer = (overrides: Partial<TaskPeer>): TaskPeer => ({
  ip: "203.0.113.5",
  port: 51413,
  client: "qBittorrent/4.6.0",
  flags: "D",
  flags_desc: "Interested, downloading",
  connection: "BT",
  country: "Brazil",
  country_code: "BR",
  downloaded: 1024,
  dl_speed: 512,
  progress: 0.5,
  uploaded: 2048,
  up_speed: 256,
  relevance: 0,
  ...overrides,
});

describe("PeersTab peer ordering", () => {
  beforeEach(() => {
    listTaskPeers.mockReset();
    banPeer.mockReset();
  });

  it("sorts by combined transfer speed descending, with fully idle peers last", async () => {
    listTaskPeers.mockResolvedValue({
      data: [
        makePeer({ ip: "1.1.1.1", dl_speed: 0, up_speed: 0 }),
        makePeer({ ip: "1.1.1.2", dl_speed: 100, up_speed: 0 }),
        makePeer({ ip: "1.1.1.3", dl_speed: 500, up_speed: 200 }),
        makePeer({ ip: "1.1.1.4", dl_speed: 0, up_speed: 50 }),
      ],
    });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("1.1.1.1:51413");

    const rows = screen.getAllByTitle(/^1\.1\.1\.\d:51413$/);
    expect(rows.map((r) => r.textContent)).toEqual([
      "1.1.1.3:51413",
      "1.1.1.2:51413",
      "1.1.1.4:51413",
      "1.1.1.1:51413",
    ]);
  });
});

describe("PeersTab country counts", () => {
  beforeEach(() => {
    listTaskPeers.mockReset();
    banPeer.mockReset();
  });

  it("groups peers by country, sorted by count, with a bucket for peers with no GeoIP data", async () => {
    listTaskPeers.mockResolvedValue({
      data: [
        makePeer({ ip: "1.1.1.1", country_code: "BR" }),
        makePeer({ ip: "1.1.1.2", country_code: "BR" }),
        makePeer({ ip: "1.1.1.3", country_code: "BR" }),
        makePeer({ ip: "1.1.1.4", country_code: "US" }),
        makePeer({ ip: "1.1.1.5", country_code: "US" }),
        makePeer({ ip: "1.1.1.6", country_code: "" }),
      ],
    });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("1.1.1.1:51413");

    const desktop = within(screen.getByTestId("country-counts-desktop"));
    const chips = desktop.getAllByText(/^\d+$/);
    expect(chips.map((c) => c.textContent)).toEqual(["3", "2", "1"]);
  });

  it("shows a +N overflow chip beyond the desktop max of 10 countries", async () => {
    const countryCodes = ["BR", "US", "DE", "FR", "GB", "JP", "CA", "AU", "IT", "ES", "NL"];
    listTaskPeers.mockResolvedValue({
      data: countryCodes.map((code, i) => makePeer({ ip: `1.1.1.${i}`, country_code: code })),
    });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("1.1.1.0:51413");

    const desktop = within(screen.getByTestId("country-counts-desktop"));
    expect(desktop.getByText("+1")).toBeInTheDocument();
    expect(desktop.getAllByText("1")).toHaveLength(10);
  });

  it("caps the mobile row at 5 countries independently of the desktop row", async () => {
    const countryCodes = ["BR", "US", "DE", "FR", "GB", "JP", "CA"];
    listTaskPeers.mockResolvedValue({
      data: countryCodes.map((code, i) => makePeer({ ip: `1.1.1.${i}`, country_code: code })),
    });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("1.1.1.0:51413");

    const mobile = within(screen.getByTestId("country-counts-mobile"));
    expect(mobile.getByText("+2")).toBeInTheDocument();
    expect(mobile.getAllByText("1")).toHaveLength(5);

    const desktop = within(screen.getByTestId("country-counts-desktop"));
    expect(desktop.queryByText(/^\+/)).not.toBeInTheDocument();
    expect(desktop.getAllByText("1")).toHaveLength(7);
  });

  it("does not render country counts while loading, on error, or when empty", async () => {
    listTaskPeers.mockResolvedValue({ data: [] });
    render(<PeersTab torrent={baseTorrent} />);

    await screen.findByText("No peers connected");
    expect(screen.queryByTestId("country-counts-desktop")).not.toBeInTheDocument();
  });
});

describe("PeersTab", () => {
  beforeEach(() => {
    listTaskPeers.mockReset();
    banPeer.mockReset();
    mockToastSuccess.mockReset();
    mockToastError.mockReset();
  });

  it("loads and renders the peer list", async () => {
    listTaskPeers.mockResolvedValue({ data: makePeers() });

    render(<PeersTab torrent={baseTorrent} />);

    expect(await screen.findByText("203.0.113.5:51413")).toBeInTheDocument();
    expect(listTaskPeers).toHaveBeenCalledWith("worker-1", "task-1");
  });

  it("shows an empty state when there are no peers", async () => {
    listTaskPeers.mockResolvedValue({ data: [] });

    render(<PeersTab torrent={baseTorrent} />);

    expect(await screen.findByText("No peers connected")).toBeInTheDocument();
  });

  it("shows an error state and allows retrying", async () => {
    listTaskPeers.mockResolvedValueOnce({ error: "network down" });
    listTaskPeers.mockResolvedValueOnce({ data: makePeers() });

    render(<PeersTab torrent={baseTorrent} />);

    expect(await screen.findByText("Failed to load peers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("203.0.113.5:51413")).toBeInTheDocument();
    expect(listTaskPeers).toHaveBeenCalledTimes(2);
  });

  it("clicking the ban button opens a confirmation dialog and does not call the service until confirmed", async () => {
    listTaskPeers.mockResolvedValue({ data: makePeers() });
    banPeer.mockResolvedValue({ data: null });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("203.0.113.5:51413");

    fireEvent.click(screen.getByRole("button", { name: "Ban this peer on every torrent on this worker" }));

    const confirmButton = await screen.findByRole("button", { name: "Ban peer" });
    expect(banPeer).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(confirmButton).not.toBeInTheDocument());
    expect(banPeer).not.toHaveBeenCalled();
  });

  it("bans a peer and removes it from the list once the dialog is confirmed", async () => {
    listTaskPeers.mockResolvedValue({ data: makePeers() });
    banPeer.mockResolvedValue({ data: null });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("203.0.113.5:51413");

    fireEvent.click(screen.getByRole("button", { name: "Ban this peer on every torrent on this worker" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ban peer" }));

    await waitFor(() => expect(banPeer).toHaveBeenCalledWith("worker-1", "203.0.113.5", 51413));
    await waitFor(() => expect(screen.queryByText("203.0.113.5:51413")).not.toBeInTheDocument());
    expect(mockToastSuccess).toHaveBeenCalled();
  });

  it("shows a toast and keeps the peer listed when the ban request fails", async () => {
    listTaskPeers.mockResolvedValue({ data: makePeers() });
    banPeer.mockResolvedValue({ error: "qbittorrent unavailable" });

    render(<PeersTab torrent={baseTorrent} />);
    await screen.findByText("203.0.113.5:51413");

    fireEvent.click(screen.getByRole("button", { name: "Ban this peer on every torrent on this worker" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ban peer" }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("qbittorrent unavailable"));
    expect(screen.getByText("203.0.113.5:51413")).toBeInTheDocument();
  });
});
