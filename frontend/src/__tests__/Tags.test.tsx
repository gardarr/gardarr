import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import Tags from "@/Tags";
import type { Tag, TagConflictReport } from "@/types/tag";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// A stable reference matters here: Tags.tsx memoizes loadTags/loadConflicts
// with useCallback([t]), and its effect depends on those callbacks - a t
// that's a fresh function every render (as react-i18next's real hook is
// not) would re-trigger the data-loading effect on every re-render.
function translate(key: string, opts?: Record<string, unknown>) {
  if (typeof opts?.defaultValue === "string") {
    return (opts.defaultValue as string).replace("{{name}}", String(opts.name ?? ""));
  }
  if (typeof opts?.count === "number") return `${key}(${opts.count})`;
  return key;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/AddTagModal", () => ({
  AddTagModal: ({ open, onTagCreated, onTagUpdated, editingTag }: {
    open: boolean;
    onTagCreated: (t: { name: string }) => void;
    onTagUpdated?: (id: string, d: { color?: string }) => void;
    editingTag?: Tag | null;
  }) =>
    open ? (
      <div data-testid="add-tag-modal">
        {editingTag && <span data-testid="editing-tag-name">{editingTag.name}</span>}
        <button onClick={() => onTagCreated({ name: "new-tag" })}>submit-create</button>
        {onTagUpdated && (
          <button onClick={() => onTagUpdated(editingTag?.id ?? "", { color: "#000000" })}>submit-update</button>
        )}
      </div>
    ) : null,
}));

vi.mock("@/components/MergeTagsModal", () => ({
  MergeTagsModal: ({ open, initialSources, initialTarget, onSubmit }: {
    open: boolean;
    initialSources: string[];
    initialTarget?: string;
    onSubmit: (sources: string[], target: string) => void;
  }) =>
    open ? (
      <div data-testid="merge-tags-modal">
        <span data-testid="merge-sources">{initialSources.join(",")}</span>
        <span data-testid="merge-target">{initialTarget}</span>
        <button onClick={() => onSubmit(initialSources, initialTarget || "merged")}>submit-merge</button>
      </div>
    ) : null,
}));

vi.mock("@/components/DeriveTagsModal", () => ({
  DeriveTagsModal: ({ open, source, onSubmit }: {
    open: boolean;
    source: string;
    onSubmit: (source: string, delimiter: string, values: string[], mode: string) => void;
  }) =>
    open ? (
      <div data-testid="derive-tags-modal">
        <span data-testid="derive-source">{source}</span>
        <button onClick={() => onSubmit(source, "", ["v1"], "prefix")}>submit-derive</button>
      </div>
    ) : null,
}));

const { toast } = await import("sonner");
const { tagService } = await import("@/services/tags");

function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: overrides.name ?? "id",
    name: "movies",
    kind: "tag",
    usage_count: 1,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const emptyConflicts: TagConflictReport = { scope_conflicts: [], grouped_tags: [] };

vi.mock("@/services/tags", () => ({
  tagService: {
    listTags: vi.fn(),
    createTag: vi.fn(),
    updateTag: vi.fn(),
    deleteTag: vi.fn(),
    renameTag: vi.fn(),
    mergeTags: vi.fn(),
    deriveTags: vi.fn(),
    getConflicts: vi.fn(),
  },
}));

describe("Tags page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tagService.getConflicts).mockResolvedValue({ data: emptyConflicts, error: undefined });
  });

  it("loads and renders tags from the service", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({
      data: [makeTag({ name: "movies", usage_count: 5 })],
      error: undefined,
    });

    render(<Tags />);

    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));
    expect(tagService.listTags).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state when there are no tags", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [], error: undefined });

    render(<Tags />);

    await waitFor(() => expect(screen.getByText("tags.noTags")).toBeInTheDocument());
  });

  it("shows a toast error when loading tags fails", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: null, error: "boom" });

    render(<Tags />);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });

  it("filters the tag list by search term", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({
      data: [makeTag({ name: "movies" }), makeTag({ name: "games" })],
      error: undefined,
    });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));

    fireEvent.change(screen.getByPlaceholderText("tags.search"), { target: { value: "gam" } });

    expect(screen.getAllByText("games").length).toBeGreaterThan(0);
    expect(screen.queryByText("movies")).not.toBeInTheDocument();
  });

  it("reloads tags and conflicts when refresh is clicked", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [], error: undefined });

    render(<Tags />);
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByLabelText("common.refresh"));

    await waitFor(() => expect(tagService.listTags).toHaveBeenCalledTimes(2));
    expect(tagService.getConflicts).toHaveBeenCalledTimes(2);
  });

  it("creates a tag via the modal and reloads the list", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [], error: undefined });
    vi.mocked(tagService.createTag).mockResolvedValue({ data: makeTag({ name: "new-tag" }), error: undefined });

    render(<Tags />);
    await waitFor(() => expect(screen.getByText("tags.noTags")).toBeInTheDocument());

    fireEvent.click(screen.getAllByText("tags.addTag")[0]);
    fireEvent.click(screen.getByText("submit-create"));

    await waitFor(() => expect(tagService.createTag).toHaveBeenCalledWith({ name: "new-tag" }));
    expect(toast.success).toHaveBeenCalledWith("tags.notifications.createSuccess");
  });

  it("opens the edit modal pre-filled with the selected tag", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [makeTag({ name: "movies" })], error: undefined });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText("Edit movies"));

    expect(screen.getByTestId("editing-tag-name")).toHaveTextContent("movies");
  });

  it("hides rename/derive actions for scope-kind tags", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({
      data: [makeTag({ name: "quality", kind: "scope" })],
      error: undefined,
    });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("quality").length).toBeGreaterThan(0));

    expect(screen.queryByLabelText("Rename quality")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Derive from quality")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Delete quality")).toBeInTheDocument();
  });

  it("deletes a tag after confirmation and warns on partial worker failure", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [makeTag({ name: "movies" })], error: undefined });
    vi.mocked(tagService.deleteTag).mockResolvedValue({
      data: { failed_workers: { "worker-1": "timeout" } },
      error: undefined,
    });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText("Delete movies"));
    expect(screen.getByText("tags.deleteConfirmTitle")).toBeInTheDocument();

    fireEvent.click(screen.getByText("common.delete"));

    await waitFor(() => expect(tagService.deleteTag).toHaveBeenCalledWith("movies", "tag"));
    expect(toast.success).toHaveBeenCalledWith("tags.notifications.deleteSuccess");
    expect(toast.warning).toHaveBeenCalledWith("tags.notifications.partialFailure(1)");
  });

  it("opens rename as a single-source merge", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [makeTag({ name: "movies" })], error: undefined });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText("Rename movies"));

    expect(screen.getByTestId("merge-sources")).toHaveTextContent("movies");
  });

  it("opens derive with the selected tag as source", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [makeTag({ name: "movies" })], error: undefined });

    render(<Tags />);
    await waitFor(() => expect(screen.getAllByText("movies").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByLabelText("Derive from movies"));

    expect(screen.getByTestId("derive-source")).toHaveTextContent("movies");
  });

  it("surfaces case-insensitive duplicate tags as merge candidates, target = highest usage", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({
      data: [
        makeTag({ name: "4k", usage_count: 2 }),
        makeTag({ name: "4K", usage_count: 10 }),
      ],
      error: undefined,
    });

    render(<Tags />);
    await waitFor(() => expect(screen.getByText("tags.mergeCandidates.title")).toBeInTheDocument());

    fireEvent.click(screen.getByText("tags.mergeCandidates.merge"));

    expect(screen.getByTestId("merge-target")).toHaveTextContent("4K");
    expect(screen.getByTestId("merge-sources")).toHaveTextContent("4k");
  });

  it("renders the backward-compatibility conflicts banner", async () => {
    vi.mocked(tagService.listTags).mockResolvedValue({ data: [], error: undefined });
    vi.mocked(tagService.getConflicts).mockResolvedValue({
      data: {
        scope_conflicts: [
          { worker_id: "w1", task_hash: "h1", task_name: "Some Torrent", scope: "quality", tags: ["quality::4k", "quality::1080p"] },
        ],
        grouped_tags: ["genre:action"],
      },
      error: undefined,
    });

    render(<Tags />);

    await waitFor(() => expect(screen.getByText("tags.conflicts.title")).toBeInTheDocument());
    expect(screen.getByText("Some Torrent")).toBeInTheDocument();
    expect(screen.getByText("genre:action")).toBeInTheDocument();
  });
});
