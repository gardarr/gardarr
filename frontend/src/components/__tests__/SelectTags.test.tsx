import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SelectTags } from "@/components/SelectTags";

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return { ...actual, Hash: () => <span aria-hidden="true" /> };
});

function inputEl() {
  return document.getElementById("tagInput") as HTMLInputElement;
}

describe("SelectTags", () => {
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
});
