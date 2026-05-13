import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddTorrentModal } from "@/components/AddTorrentModal";
import type { Task } from "@/types/torrent";
import type { Worker } from "@/types/worker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-portrait-mobile-tablet", () => ({
  useIsPortraitMobileOrTablet: () => false,
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => <span aria-hidden="true" />,
  Check: () => <span aria-hidden="true" />,
  ChevronsUpDown: () => <span aria-hidden="true" />,
  Database: () => <span aria-hidden="true" />,
  Download: () => <span aria-hidden="true" />,
  FileText: () => <span aria-hidden="true" />,
  Folder: () => <span aria-hidden="true" />,
  Globe: () => <span aria-hidden="true" />,
  HardDrive: () => <span aria-hidden="true" />,
  Link: () => <span aria-hidden="true" />,
  Loader2: () => <span aria-hidden="true" />,
  Server: () => <span aria-hidden="true" />,
  Sparkles: () => <span aria-hidden="true" />,
  X: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    type = "button",
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />,
}));

vi.mock("@/components/ui/WorkerIcon", () => ({
  WorkerIcon: () => <span aria-hidden="true" />,
}));

vi.mock("@/components/SelectCategory", () => ({
  SelectCategory: ({
    onCategoryChange,
  }: {
    onCategoryChange: (categoryId: string, category?: { id: string; name: string; default_tags?: string[]; default_directory?: string }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onCategoryChange("cat-1", {
          id: "cat-1",
          name: "Games",
          default_tags: ["auto-tag"],
          default_directory: "/downloads/games",
        })
      }
    >
      Select category
    </button>
  ),
}));

vi.mock("@/components/SelectTags", () => ({
  SelectTags: () => <div>Tags</div>,
}));

vi.mock("@/components/reui/stepper", () => ({
  Stepper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperIndicator: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperNav: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperSeparator: () => <div />,
  StepperTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  StepperTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/services/torrents", () => ({
  convertMagnetUriToTaskMagnetLink: (magnetUri: string) => ({
    hash: "hash-1",
    display_name: magnetUri,
    trackers: [],
    exact_length: "",
    exact_source: "",
  }),
}));

const baseWorker: Worker = {
  uuid: "worker-1",
  name: "Worker 1",
  address: "http://worker.test",
  icon: "server",
  color: "blue",
  status: "ACTIVE",
  instance: {
    application: {
      version: "1.0.0",
      api_version: "2.0.0",
    },
    server: {
      free_space_on_disk: 1024,
    },
    transfer: {
      all_time_downloaded: 0,
      all_time_uploaded: 0,
      global_ratio: 0,
      last_external_address_v4: "",
      last_external_address_v6: "",
    },
  },
};

const baseTask: Task = {
  id: "task-1",
  name: "Task 1",
  hash: "hash-1",
  created_at: "2024-01-01T00:00:00Z",
  state: "queued",
  category: "Games",
  path: "/downloads/task-1",
  priority: 0,
  ratio: 0,
  size: 0,
  progress: 0,
  magnet_uri: "magnet:?xt=urn:btih:test-hash",
  magnet_link: {
    hash: "hash-1",
    display_name: "Task 1",
    trackers: [],
    exact_length: "",
    exact_source: "",
  },
  popularity: 0,
  pairs: {
    swarm_seeders: 0,
    swarm_leechers: 0,
    seeders: 0,
    leechers: 0,
  },
  network: {
    download: { speed: 0, amount: 0 },
    upload: { speed: 0, amount: 0 },
  },
  tags: ["auto-tag"],
};

describe("AddTorrentModal", () => {
  it("preserves form state across worker refreshes and still defaults the worker on open", () => {
    const onCreateTorrent = vi.fn(async () => {
      throw new Error("should not submit");
    });
    const onFinalizeTorrent = vi.fn(async () => {});

    const { rerender } = render(
      <AddTorrentModal
        isOpen={true}
        onClose={() => {}}
        onCreateTorrent={onCreateTorrent}
        onFinalizeTorrent={onFinalizeTorrent}
        workers={[baseWorker]}
      />
    );

    const magnetInput = screen.getByPlaceholderText("torrents.addModal.magnetUri.placeholder");
    fireEvent.change(magnetInput, { target: { value: "magnet:?xt=urn:btih:test-hash" } });
    fireEvent.click(screen.getByRole("button", { name: "Select category" }));
    fireEvent.click(screen.getByRole("button", { name: "torrents.next" }));

    expect(screen.getByDisplayValue("magnet:?xt=urn:btih:test-hash")).toBeInTheDocument();
    expect(screen.getAllByText("Worker 1")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "torrents.previous" })).toBeInTheDocument();

    rerender(
      <AddTorrentModal
        isOpen={true}
        onClose={() => {}}
        onCreateTorrent={onCreateTorrent}
        onFinalizeTorrent={onFinalizeTorrent}
        workers={[
          { ...baseWorker, address: "http://worker-updated.test" },
          { ...baseWorker, uuid: "worker-2", name: "Worker 2" },
        ]}
      />
    );

    expect(screen.getByDisplayValue("magnet:?xt=urn:btih:test-hash")).toBeInTheDocument();
    expect(screen.getAllByText("Worker 1")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "torrents.previous" })).toBeInTheDocument();
  });

  it("reuses the created task when finalize fails and clears the recoverable error on reopen", async () => {
    const onCreateTorrent = vi.fn(async () => baseTask);
    const onFinalizeTorrent = vi
      .fn(async () => {})
      .mockRejectedValueOnce(new Error("Finalize failed"))
      .mockResolvedValueOnce();

    const { rerender } = render(
      <AddTorrentModal
        isOpen={true}
        onClose={() => {}}
        onCreateTorrent={onCreateTorrent}
        onFinalizeTorrent={onFinalizeTorrent}
        workers={[baseWorker]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("torrents.addModal.magnetUri.placeholder"), {
      target: { value: "magnet:?xt=urn:btih:test-hash" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Select category" }));
    fireEvent.click(screen.getByRole("button", { name: "torrents.next" }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreateTorrent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onFinalizeTorrent).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("alert")).toHaveTextContent("Finalize failed");

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => expect(onCreateTorrent).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onFinalizeTorrent).toHaveBeenCalledTimes(2));

    rerender(
      <AddTorrentModal
        isOpen={false}
        onClose={() => {}}
        onCreateTorrent={onCreateTorrent}
        onFinalizeTorrent={onFinalizeTorrent}
        workers={[baseWorker]}
      />
    );
    rerender(
      <AddTorrentModal
        isOpen={true}
        onClose={() => {}}
        onCreateTorrent={onCreateTorrent}
        onFinalizeTorrent={onFinalizeTorrent}
        workers={[baseWorker]}
      />
    );

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });
});
