import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TaskMetadataSearchSheet } from "@/components/TaskMetadataSearchSheet";
import { taskMetadataService } from "@/services/taskMetadata";
import type { Category } from "@/types/category";
import type { Task } from "@/types/torrent";
import { toast } from "sonner";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/use-portrait-mobile-tablet", () => ({
  useIsPortraitMobileOrTablet: () => false,
}));

vi.mock("lucide-react", () => ({
  Calendar: () => <span aria-hidden="true" />,
  Check: () => <span aria-hidden="true" />,
  Image: () => <span aria-hidden="true" />,
  Loader2: () => <span aria-hidden="true" />,
  Search: () => <span aria-hidden="true" />,
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

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/services/taskMetadata", () => ({
  taskMetadataService: {
    getProviderStatus: vi.fn(),
    searchProvider: vi.fn(),
    applyProvider: vi.fn(),
  },
}));

const baseTask: Task = {
  id: "task-1",
  name: "Halo",
  hash: "hash-1",
  created_at: "2024-01-01T00:00:00Z",
  state: "queued",
  category: "Games",
  path: "/downloads/halo",
  priority: 0,
  ratio: 0,
  size: 0,
  progress: 0,
  magnet_uri: "magnet:?xt=urn:btih:test",
  magnet_link: {
    hash: "hash-1",
    display_name: "Halo",
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
  metadata: null,
};

const baseCategory: Category = {
  id: "cat-1",
  name: "Games",
  default_tags: [],
  default_directory: "/downloads/games",
  metadata_source: "tgdb",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

describe("TaskMetadataSearchSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(taskMetadataService.getProviderStatus).mockResolvedValue({
      data: {
        provider: "tgdb",
        active: true,
      },
    });

    vi.mocked(taskMetadataService.searchProvider).mockResolvedValue({
      data: [
        {
          id: "123",
          title: "Halo",
          release_date: "2024-01-01",
          description: "Overview",
          image_url: "https://cdn.thegamesdb.net/images/large/front.jpg",
        },
      ],
    });
  });

  it("applies metadata using the selected id with fallback metadata", async () => {
    const onApplied = vi.fn();
    const onClose = vi.fn();

    vi.mocked(taskMetadataService.applyProvider).mockResolvedValue({
      data: {
        uuid: "meta-1",
        task_hash: "hash-1",
        name: "Halo",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    render(
      <TaskMetadataSearchSheet
        isOpen={true}
        onClose={onClose}
        task={baseTask}
        category={baseCategory}
        onApplied={onApplied}
      />
    );

    await waitFor(() => expect(taskMetadataService.searchProvider).toHaveBeenCalledWith("tgdb", "Halo"));

    fireEvent.click(screen.getByRole("button", { name: "torrents.addModal.actions.finish" }));

    await waitFor(() =>
      expect(taskMetadataService.applyProvider).toHaveBeenCalledWith("hash-1", "tgdb", {
        id: "123",
        title: "Halo",
        release_date: "2024-01-01",
        description: "Overview",
        image_url: "https://cdn.thegamesdb.net/images/large/front.jpg",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("tgdb.success.applied");
    expect(onApplied).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("shows a toast and resets the loading state when apply fails", async () => {
    const user = userEvent.setup();
    const onApplied = vi.fn();
    const onClose = vi.fn();

    vi.mocked(taskMetadataService.applyProvider).mockResolvedValue({
      error: "id is required",
    });

    render(
      <TaskMetadataSearchSheet
        isOpen={true}
        onClose={onClose}
        task={baseTask}
        category={baseCategory}
        onApplied={onApplied}
      />
    );

    await waitFor(() => expect(taskMetadataService.searchProvider).toHaveBeenCalledWith("tgdb", "Halo"));

    await user.click(screen.getByRole("button", { name: "torrents.addModal.actions.finish" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("id is required"));
    expect(onApplied).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "torrents.addModal.actions.finish" })).toBeEnabled();
  });
});
