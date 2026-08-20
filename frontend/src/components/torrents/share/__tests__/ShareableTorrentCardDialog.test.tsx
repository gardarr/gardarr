import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/types/torrent";
import { ShareableTorrentCardDialog } from "../ShareableTorrentCardDialog";

const mocks = vi.hoisted(() => ({
  canShareCardFiles: vi.fn(() => false),
  copyShareCardImage: vi.fn(),
  createShareCardBlob: vi.fn(),
  downloadShareCardImage: vi.fn(),
  shareCardImage: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../ShareableTorrentCard", () => ({
  ShareableTorrentCard: ({ format, theme }: { format: string; theme: string }) => (
    <div data-testid="card-preview">{format}-{theme}</div>
  ),
}));

vi.mock("../shareCardExport", () => mocks);

const torrent = {
  id: "torrent-1",
  hash: "hash-1",
  name: "Technical.Name.1080p",
  ratio: 12.5,
  popularity: 3.2,
  metadata: {
    uuid: "meta-1",
    task_hash: "hash-1",
    name: "Friendly Name",
    description: "Description",
    created_at: "2026-08-12T00:00:00Z",
    updated_at: "2026-08-12T00:00:00Z",
  },
} as Task;

describe("ShareableTorrentCardDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canShareCardFiles.mockReturnValue(false);
    mocks.createShareCardBlob.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
  });

  it("switches between all formats and themes", async () => {
    const user = userEvent.setup();
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    expect(screen.getByTestId("card-preview")).toHaveTextContent("portrait-dark");

    await user.click(screen.getByRole("button", { name: /formats\.square/ }));
    expect(screen.getByTestId("card-preview")).toHaveTextContent("square-dark");

    await user.click(screen.getByRole("button", { name: /themes\.light/ }));
    expect(screen.getByTestId("card-preview")).toHaveTextContent("square-light");

    await user.click(screen.getByRole("button", { name: /formats\.story/ }));
    expect(screen.getByTestId("card-preview")).toHaveTextContent("story-light");
  });

  it("downloads the selected format and theme", async () => {
    const user = userEvent.setup();
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    await user.click(screen.getByRole("button", { name: /formats\.square/ }));
    await user.click(screen.getByRole("button", { name: /themes\.light/ }));
    await user.click(screen.getByRole("button", { name: "torrentDetails.shareCard.download" }));

    await waitFor(() => {
      expect(mocks.createShareCardBlob).toHaveBeenCalledWith(torrent, {
        format: "square",
        theme: "light",
        imagePositionY: 50,
        includeDescription: false,
        titleColor: "#0F172A",
        username: "",
      });
      expect(mocks.downloadShareCardImage).toHaveBeenCalled();
    });
  });

  it("shows native sharing only when the browser supports image files", async () => {
    mocks.canShareCardFiles.mockReturnValue(true);
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    expect(await screen.findByRole("button", { name: "torrentDetails.shareCard.nativeShare" })).toBeInTheDocument();
  });

  it("hides native sharing when the browser does not support image files", () => {
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    expect(screen.queryByRole("button", { name: "torrentDetails.shareCard.nativeShare" })).not.toBeInTheDocument();
  });

  it("omits the torrent description by default", async () => {
    const user = userEvent.setup();
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    expect(screen.getByRole("switch", { name: "torrentDetails.shareCard.includeDescription" })).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "torrentDetails.shareCard.download" }));

    await waitFor(() => {
      expect(mocks.createShareCardBlob).toHaveBeenCalledWith(torrent, expect.objectContaining({
        includeDescription: false,
      }));
    });
  });

  it("exports an optional username badge", async () => {
    const user = userEvent.setup();
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    await user.type(screen.getByPlaceholderText("torrentDetails.shareCard.usernamePlaceholder"), "gardarr_user");
    await user.click(screen.getByRole("button", { name: "torrentDetails.shareCard.download" }));

    await waitFor(() => {
      expect(mocks.createShareCardBlob).toHaveBeenCalledWith(torrent, expect.objectContaining({
        username: "gardarr_user",
      }));
    });
  });

  it("exports the customized torrent title color", async () => {
    const user = userEvent.setup();
    render(<ShareableTorrentCardDialog torrent={torrent} open onOpenChange={() => undefined} />);

    const colorField = screen.getByDisplayValue("#FAFAFA");
    await user.clear(colorField);
    await user.type(colorField, "#22C55E");
    await user.click(screen.getByRole("button", { name: "torrentDetails.shareCard.download" }));

    await waitFor(() => {
      expect(mocks.createShareCardBlob).toHaveBeenCalledWith(torrent, expect.objectContaining({
        titleColor: "#22C55E",
      }));
    });
  });
});
