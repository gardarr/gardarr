import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MergeTagsModal } from "@/components/MergeTagsModal";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}));
vi.mock("@/components/ui/input", () => ({
  Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));
vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

const { toast } = await import("sonner");

function addSource(text: string) {
  const input = screen.getByPlaceholderText("tags.placeholders.sources");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("MergeTagsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("titles itself a rename with a single source and a merge with several", () => {
    const { rerender } = render(
      <MergeTagsModal open onOpenChange={vi.fn()} initialSources={["movies"]} onSubmit={vi.fn()} />
    );
    expect(screen.getByText("tags.renameTitle")).toBeInTheDocument();

    rerender(
      <MergeTagsModal open onOpenChange={vi.fn()} initialSources={["movies", "films"]} onSubmit={vi.fn()} />
    );
    expect(screen.getByText("tags.mergeTitle")).toBeInTheDocument();
  });

  it("seeds sources and target from props when opened", () => {
    render(
      <MergeTagsModal
        open
        onOpenChange={vi.fn()}
        initialSources={["movies"]}
        initialTarget="films"
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText("movies")).toBeInTheDocument();
    expect(screen.getByDisplayValue("films")).toBeInTheDocument();
  });

  it("adds a source on Enter and removes the last one via Backspace on an empty input", () => {
    render(<MergeTagsModal open onOpenChange={vi.fn()} initialSources={[]} onSubmit={vi.fn()} />);

    addSource("movies");
    expect(screen.getByText("movies")).toBeInTheDocument();

    const input = document.getElementById("merge-source-input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("movies")).not.toBeInTheDocument();
  });

  it("ignores duplicate sources", () => {
    render(<MergeTagsModal open onOpenChange={vi.fn()} initialSources={["movies"]} onSubmit={vi.fn()} />);

    const input = document.getElementById("merge-source-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "movies" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getAllByText("movies")).toHaveLength(1);
  });

  it("blocks submit with no sources", () => {
    const onSubmit = vi.fn();
    render(<MergeTagsModal open onOpenChange={vi.fn()} initialSources={[]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "tags.rename" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.sourcesRequired");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit with no target", () => {
    const onSubmit = vi.fn();
    render(<MergeTagsModal open onOpenChange={vi.fn()} initialSources={["movies"]} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "tags.rename" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.targetRequired");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit when the target is also a source", () => {
    const onSubmit = vi.fn();
    render(<MergeTagsModal open onOpenChange={vi.fn()} initialSources={["movies"]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("tags.fields.target"), { target: { value: "movies" } });
    fireEvent.click(screen.getByRole("button", { name: "tags.rename" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.targetInSources");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed sources and target, then closes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<MergeTagsModal open onOpenChange={onOpenChange} initialSources={["movies"]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("tags.fields.target"), { target: { value: "  films  " } });
    fireEvent.click(screen.getByRole("button", { name: "tags.rename" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith(["movies"], "films"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stays open and does not throw when onSubmit rejects", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();
    render(<MergeTagsModal open onOpenChange={onOpenChange} initialSources={["movies"]} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText("tags.fields.target"), { target: { value: "films" } });
    fireEvent.click(screen.getByRole("button", { name: "tags.rename" }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
