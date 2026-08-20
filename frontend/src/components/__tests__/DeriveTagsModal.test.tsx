import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DeriveTagsModal } from "@/components/DeriveTagsModal";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { separator?: string }) => (opts?.separator ? `${key}(${opts.separator})` : key),
  }),
}));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Wand2: () => <span aria-hidden="true" />,
  };
});
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, id }: { checked: boolean; onCheckedChange: (checked: boolean) => void; id?: string }) => (
    <button type="button" role="switch" id={id} aria-checked={checked} onClick={() => onCheckedChange(!checked)} />
  ),
}));

const { toast } = await import("sonner");

function addValue(placeholder: string, text: string) {
  const input = screen.getByPlaceholderText(placeholder);
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter" });
}

describe("DeriveTagsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the delimiter field for a plain source and hides it for a scoped one", () => {
    const { rerender } = render(
      <DeriveTagsModal open onOpenChange={vi.fn()} source="movies" onSubmit={vi.fn()} />
    );
    expect(screen.getByLabelText("tags.fields.delimiter")).toBeInTheDocument();

    rerender(<DeriveTagsModal open onOpenChange={vi.fn()} source="quality::4k" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText("tags.fields.delimiter")).not.toBeInTheDocument();
    expect(screen.getByText("tags.deriveComposedHint(::)")).toBeInTheDocument();
  });

  it("blocks submit with no values", () => {
    const onSubmit = vi.fn();
    render(<DeriveTagsModal open onOpenChange={vi.fn()} source="movies" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "tags.derive" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.prefixesRequired");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submit for a plain source with no delimiter", () => {
    const onSubmit = vi.fn();
    render(<DeriveTagsModal open onOpenChange={vi.fn()} source="movies" onSubmit={onSubmit} />);

    addValue("tags.placeholders.prefixes", "hd");
    fireEvent.click(screen.getByRole("button", { name: "tags.derive" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.delimiterRequired");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders a live preview and submits derived values for a scoped source", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<DeriveTagsModal open onOpenChange={onOpenChange} source="quality::4k" onSubmit={onSubmit} />);

    addValue("tags.placeholders.prefixes", "1080p");

    // prefix mode keeps source's value half ("4k") fixed, varying the key
    // half - preview is "1080p::4k".
    expect(screen.getByText("tags.derivePreview")).toBeInTheDocument();
    expect(screen.getAllByText("1080p").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4k").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "tags.derive" }));

    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("quality::4k", "", ["1080p"], "prefix")
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("switches to suffix mode and submits with the switched mode", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DeriveTagsModal open onOpenChange={vi.fn()} source="quality::4k" onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("switch"));
    addValue("tags.placeholders.suffixes", "1080p");
    fireEvent.click(screen.getByRole("button", { name: "tags.derive" }));

    await vi.waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith("quality::4k", "", ["1080p"], "suffix")
    );
  });

  it("removes a value on Backspace with an empty input", () => {
    render(<DeriveTagsModal open onOpenChange={vi.fn()} source="quality::4k" onSubmit={vi.fn()} />);

    addValue("tags.placeholders.prefixes", "1080p");
    expect(screen.getAllByText("1080p").length).toBeGreaterThan(0);

    const input = document.getElementById("derive-value-input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(screen.queryByText("1080p")).not.toBeInTheDocument();
  });
});
