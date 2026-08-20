import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddTorrentModal } from "@/components/AddTorrentModal";
import { AddTorrentContext, type AddTorrentContextValue } from "@/contexts/add-torrent-context";
import type { Task } from "@/types/torrent";
import type { Worker } from "@/types/worker";

const navigateMock = vi.fn();
let currentPathname = "/workers";

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ pathname: currentPathname }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-portrait-mobile-tablet", () => ({
  useIsPortraitMobileOrTablet: () => false,
}));

vi.mock("lucide-react", () => ({
  Check: () => <span aria-hidden="true" />,
  ChevronsUpDown: () => <span aria-hidden="true" />,
  Database: () => <span aria-hidden="true" />,
  Download: () => <span aria-hidden="true" />,
  FileText: () => <span aria-hidden="true" />,
  FileUp: () => <span aria-hidden="true" />,
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
    error,
  }: {
    onCategoryChange: (categoryId: string, category?: { id: string; name: string; default_tags?: string[]; default_directory?: string }) => void;
    error?: string;
  }) => (
    <div>
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
      {error && <p>{error}</p>}
    </div>
  ),
}));

vi.mock("@/components/SelectTags", () => ({
  SelectTags: ({ tags, error }: { tags: string[]; error?: string }) => (
    <div>
      <div data-testid="tags">{tags.join(",")}</div>
      {error && <p>{error}</p>}
    </div>
  ),
}));

const createTaskMock = vi.fn();

vi.mock("@/services/torrents", () => ({
  convertMagnetUriToTaskMagnetLink: (magnetUri: string) => ({
    hash: "HASH-1",
    display_name: magnetUri,
    trackers: [],
    exact_length: "",
    exact_source: "",
  }),
  torrentService: {
    createTask: (...args: unknown[]) => createTaskMock(...args),
  },
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

vi.mock("@/services/workers", () => ({
  workerService: {
    listWorkers: () => Promise.resolve({ data: [baseWorker] }),
  },
}));

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

function buildContext(overrides: Partial<AddTorrentContextValue> = {}): AddTorrentContextValue {
  return {
    isAddModalOpen: true,
    addModalMode: "magnet",
    openAddModal: vi.fn(),
    closeAddModal: vi.fn(),
    pendingTorrents: [],
    addPendingTorrent: vi.fn(),
    removePendingTorrent: vi.fn(),
    ...overrides,
  };
}

function renderModal(context: AddTorrentContextValue) {
  return render(
    <AddTorrentContext.Provider value={context}>
      <AddTorrentModal />
    </AddTorrentContext.Provider>
  );
}

async function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("torrents.addModal.magnetUri.placeholder"), {
    target: { value: "magnet:?xt=urn:btih:test-hash" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Select category" }));
  await waitFor(() => expect(screen.getAllByText("Worker 1")[0]).toBeInTheDocument());
}

describe("AddTorrentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = "/workers";
    createTaskMock.mockResolvedValue({ data: baseTask });
  });

  it("renders magnet and upload tabs without step navigation", async () => {
    renderModal(buildContext());

    await waitFor(() => expect(screen.getAllByText("Worker 1")[0]).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "torrents.next" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "torrents.addModal.source.magnet" })).toHaveAttribute("data-state", "active");
    expect(screen.getByPlaceholderText("torrents.addModal.magnetUri.placeholder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "torrents.addModal.actions.add" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("torrents.addModal.directory.placeholder")).toBeInTheDocument();
  });

  it("switches between magnet and torrent file upload", async () => {
    const user = userEvent.setup();
    renderModal(buildContext());

    await user.click(screen.getByRole("tab", { name: "torrents.addModal.source.upload" }));

    await waitFor(() => {
      expect(screen.getByLabelText(/torrents.addModal.file.label/)).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("torrents.addModal.magnetUri.placeholder")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("tab", { name: "torrents.addModal.source.magnet" }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("torrents.addModal.magnetUri.placeholder")).toBeInTheDocument();
    });
  });

  it("auto-fills directory and tags when a category is selected", async () => {
    renderModal(buildContext());

    fireEvent.click(screen.getByRole("button", { name: "Select category" }));

    expect(screen.getByDisplayValue("/downloads/games")).toBeInTheDocument();
    expect(screen.getByTestId("tags")).toHaveTextContent("auto-tag");
  });

  it("submits optimistically: pending placeholder, close, navigate, createTask", async () => {
    const context = buildContext();
    renderModal(context);
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "torrents.addModal.actions.add" }));

    await waitFor(() => expect(createTaskMock).toHaveBeenCalledTimes(1));
    expect(createTaskMock).toHaveBeenCalledWith("worker-1", {
      magnet_uri: "magnet:?xt=urn:btih:test-hash",
      category: "Games",
      tags: ["auto-tag"],
      directory: "/downloads/games",
    });
    expect(context.addPendingTorrent).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: "hash-1",
        workerId: "worker-1",
        category: "Games",
      })
    );
    expect(context.closeAddModal).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith("/torrents");
    expect(context.removePendingTorrent).not.toHaveBeenCalled();
  });

  it("does not navigate when already on /torrents", async () => {
    currentPathname = "/torrents";
    const context = buildContext();
    renderModal(context);
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "torrents.addModal.actions.add" }));

    await waitFor(() => expect(createTaskMock).toHaveBeenCalledTimes(1));
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("removes the pending placeholder when createTask fails", async () => {
    createTaskMock.mockResolvedValue({ error: "boom" });
    const context = buildContext();
    renderModal(context);
    await fillForm();

    fireEvent.click(screen.getByRole("button", { name: "torrents.addModal.actions.add" }));

    await waitFor(() => expect(context.removePendingTorrent).toHaveBeenCalledWith("hash-1"));
    expect(context.addPendingTorrent).toHaveBeenCalled();
  });

  it("blocks submission when required fields are missing", async () => {
    const context = buildContext();
    renderModal(context);
    await waitFor(() => expect(screen.getAllByText("Worker 1")[0]).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "torrents.addModal.actions.add" }));

    expect(createTaskMock).not.toHaveBeenCalled();
    expect(context.addPendingTorrent).not.toHaveBeenCalled();
    expect(screen.getByText("torrents.addModal.errors.magnetRequired")).toBeInTheDocument();
    expect(screen.getByText("torrents.addModal.errors.categoryRequired")).toBeInTheDocument();
    expect(screen.getByText("torrents.addModal.errors.tagsRequired")).toBeInTheDocument();
  });
});
