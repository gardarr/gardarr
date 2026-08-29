import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TorrentFilesList } from "../TorrentFilesList";
import type { TaskFile } from "@/types/torrent";

const listTaskFiles = vi.fn();
const setTaskFilePriority = vi.fn();

vi.mock("@/services/torrents", () => ({
  torrentService: {
    listTaskFiles: (...args: unknown[]) => listTaskFiles(...args),
    setTaskFilePriority: (...args: unknown[]) => setTaskFilePriority(...args),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; name?: string }) =>
      (opts?.defaultValue ?? key).replace("{{name}}", opts?.name ?? ""),
  }),
}));

const makeFiles = (): TaskFile[] => [
  {
    index: 0,
    name: "episode1.mkv",
    size: 1024,
    progress: 0.5,
    priority: 1,
    is_seed: false,
    piece_range: [0, 10],
    availability: 1,
  },
  {
    index: 1,
    name: "episode2.mkv",
    size: 2048,
    progress: 1,
    priority: 1,
    is_seed: false,
    piece_range: [11, 20],
    availability: 1,
  },
];

describe("TorrentFilesList", () => {
  beforeEach(() => {
    listTaskFiles.mockReset();
    setTaskFilePriority.mockReset();
  });

  it("unchecking a file and applying sends priority 0 for that file and reloads the list", async () => {
    listTaskFiles.mockResolvedValue({ data: makeFiles() });
    setTaskFilePriority.mockResolvedValue({ data: null });

    render(<TorrentFilesList workerId="worker-1" taskId="task-1" showAccordion={false} />);

    const checkboxes = await screen.findAllByRole("checkbox");
    expect(checkboxes).toHaveLength(2);

    fireEvent.click(checkboxes[0]);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() => expect(setTaskFilePriority).toHaveBeenCalledWith("worker-1", "task-1", [0], 0));
    // Applying reloads the file list to reflect qBittorrent's recomputed progress/priorities.
    await waitFor(() => expect(listTaskFiles).toHaveBeenCalledTimes(2));
  });

  it("clicking Apply opens a confirmation dialog and does not call the service until confirmed", async () => {
    listTaskFiles.mockResolvedValue({ data: makeFiles() });
    setTaskFilePriority.mockResolvedValue({ data: null });

    render(<TorrentFilesList workerId="worker-1" taskId="task-1" showAccordion={false} />);

    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));

    const confirmButton = await screen.findByRole("button", { name: "Confirmar" });
    expect(setTaskFilePriority).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(confirmButton).not.toBeInTheDocument());
    expect(setTaskFilePriority).not.toHaveBeenCalled();
  });

  it("surfaces the backend's all-files-deselected rejection without losing the pending change", async () => {
    listTaskFiles.mockResolvedValue({ data: makeFiles() });
    setTaskFilePriority.mockResolvedValue({
      error: "cannot deselect every file in a torrent - remove the torrent instead",
    });

    render(<TorrentFilesList workerId="worker-1" taskId="task-1" showAccordion={false} />);

    const checkboxes = await screen.findAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(screen.getByText(/cannot deselect every file/i)).toBeInTheDocument()
    );
    // The list must not have been reloaded (which would have discarded the
    // still-unapplied change), and the checkboxes remain unchecked so the
    // user can adjust and retry.
    expect(listTaskFiles).toHaveBeenCalledTimes(1);
  });
});
