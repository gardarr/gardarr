import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SelectTags } from "@/components/SelectTags";
import { tagService } from "@/services/tags";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return { ...actual, Hash: () => <span aria-hidden="true" /> };
});

vi.mock("@/services/tags", () => ({
  tagService: {
    listTags: vi.fn(),
  },
}));

function inputEl() {
  return document.getElementById("tagInput") as HTMLInputElement;
}

function mockKnownTags(names: string[]) {
  vi.mocked(tagService.listTags).mockResolvedValue({
    data: names.map((name) => ({
      id: name,
      name,
      kind: "tag" as const,
      usage_count: 0,
      created_at: "",
      updated_at: "",
    })),
  });
}

describe("SelectTags", () => {
  beforeEach(() => {
    vi.mocked(tagService.listTags).mockReset();
  });

  it("renders the label with a required marker", () => {
    render(<SelectTags tags={[]} onTagsChange={vi.fn()} label="Tags" required />);
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("hides the label when it is an empty string", () => {
    render(<SelectTags tags={[]} onTagsChange={vi.fn()} label="" />);
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
  });

  it("adds a tag on Enter, stripping whitespace", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.change(inputEl(), { target: { value: "  my tag  " } });
    fireEvent.keyDown(inputEl(), { key: "Enter" });

    expect(onTagsChange).toHaveBeenCalledWith(["mytag"]);
  });

  it("splits comma-separated input into multiple tags", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.change(inputEl(), { target: { value: "a, b, c" } });
    fireEvent.keyDown(inputEl(), { key: "Enter" });

    expect(onTagsChange).toHaveBeenCalledWith(["a", "b", "c"]);
  });

  it("does not add duplicate tags already present", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={["a"]} onTagsChange={onTagsChange} />);

    fireEvent.change(inputEl(), { target: { value: "a" } });
    fireEvent.keyDown(inputEl(), { key: "Enter" });

    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("removes the last tag on Backspace with an empty input", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={["a", "b"]} onTagsChange={onTagsChange} />);

    fireEvent.keyDown(inputEl(), { key: "Backspace" });

    expect(onTagsChange).toHaveBeenCalledWith(["a"]);
  });

  it("removes a tag via its badge delete button", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={["a", "b"]} onTagsChange={onTagsChange} />);

    const deleteButtons = document.querySelectorAll("button");
    fireEvent.click(deleteButtons[0]);

    expect(onTagsChange).toHaveBeenCalledWith(["b"]);
  });

  it("adds the pending tag on blur", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.change(inputEl(), { target: { value: "pending" } });
    fireEvent.blur(inputEl());

    expect(onTagsChange).toHaveBeenCalledWith(["pending"]);
  });

  it("ignores all interactions while disabled", () => {
    const onTagsChange = vi.fn();
    render(<SelectTags tags={["a"]} onTagsChange={onTagsChange} disabled />);

    fireEvent.keyDown(inputEl(), { key: "Backspace" });
    expect(onTagsChange).not.toHaveBeenCalled();
    expect(inputEl()).toBeDisabled();
  });

  it("shows the error message and help text when provided", () => {
    render(
      <SelectTags
        tags={[]}
        onTagsChange={vi.fn()}
        error="Required"
        showHelp
        helpText="Press Enter to add"
      />
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByText("Press Enter to add")).toBeInTheDocument();
  });

  it("shows matching suggestions from known tags after focus and typing", async () => {
    mockKnownTags(["alpha", "alphabet", "beta"]);
    render(<SelectTags tags={[]} onTagsChange={vi.fn()} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());

    fireEvent.change(inputEl(), { target: { value: "al" } });

    expect(await screen.findByRole("option", { name: "alpha" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "alphabet" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "beta" })).not.toBeInTheDocument();
  });

  it("excludes already-selected tags from suggestions", async () => {
    mockKnownTags(["alpha", "alphabet"]);
    render(<SelectTags tags={["alpha"]} onTagsChange={vi.fn()} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());
    fireEvent.change(inputEl(), { target: { value: "al" } });

    expect(await screen.findByRole("option", { name: "alphabet" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();
  });

  it("selects the arrow-highlighted suggestion on Enter", async () => {
    const onTagsChange = vi.fn();
    mockKnownTags(["alpha", "zzzalpha"]);
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());
    fireEvent.change(inputEl(), { target: { value: "alpha" } });
    await screen.findByRole("option", { name: "alpha" });

    fireEvent.keyDown(inputEl(), { key: "ArrowDown" });
    fireEvent.keyDown(inputEl(), { key: "Enter" });

    expect(onTagsChange).toHaveBeenCalledWith(["alpha"]);
  });

  it("selects a suggestion via click", async () => {
    const onTagsChange = vi.fn();
    mockKnownTags(["alpha", "alphabet"]);
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());
    fireEvent.change(inputEl(), { target: { value: "al" } });

    const option = await screen.findByRole("option", { name: "alphabet" });
    fireEvent.mouseDown(option.querySelector("button")!);

    expect(onTagsChange).toHaveBeenCalledWith(["alphabet"]);
  });

  it("closes suggestions on Escape without adding a tag", async () => {
    const onTagsChange = vi.fn();
    mockKnownTags(["alpha"]);
    render(<SelectTags tags={[]} onTagsChange={onTagsChange} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());
    fireEvent.change(inputEl(), { target: { value: "al" } });
    await screen.findByRole("listbox");

    fireEvent.keyDown(inputEl(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onTagsChange).not.toHaveBeenCalled();
  });

  it("closes suggestions when clicking outside the component", async () => {
    mockKnownTags(["alpha"]);
    render(<SelectTags tags={[]} onTagsChange={vi.fn()} />);

    fireEvent.focus(inputEl());
    await waitFor(() => expect(tagService.listTags).toHaveBeenCalled());
    fireEvent.change(inputEl(), { target: { value: "al" } });
    await screen.findByRole("listbox");

    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not fetch known tags on focus while disabled", () => {
    render(<SelectTags tags={[]} onTagsChange={vi.fn()} disabled />);

    fireEvent.focus(inputEl());

    expect(tagService.listTags).not.toHaveBeenCalled();
  });
});
