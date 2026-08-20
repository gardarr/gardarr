import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AddTagModal } from "@/components/AddTagModal";
import type { Tag } from "@/types/tag";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Check: () => <span aria-hidden="true" />,
    Tag: () => <span aria-hidden="true" />,
  };
});
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

const editingTag: Tag = {
  id: "tag-1",
  name: "movies",
  kind: "tag",
  color: "#ff0000",
  usage_count: 2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("AddTagModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the name field in create mode and blocks submit when empty", () => {
    const onTagCreated = vi.fn();
    render(<AddTagModal open onOpenChange={vi.fn()} onTagCreated={onTagCreated} />);

    expect(screen.getByLabelText("tags.fields.name *")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "tags.create" }));

    expect(toast.error).toHaveBeenCalledWith("tags.errors.nameRequired");
    expect(onTagCreated).not.toHaveBeenCalled();
  });

  it("submits a new tag with the typed name and selected color", async () => {
    const onTagCreated = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(<AddTagModal open onOpenChange={onOpenChange} onTagCreated={onTagCreated} />);

    fireEvent.change(screen.getByLabelText("tags.fields.name *"), { target: { value: "movies" } });
    fireEvent.click(screen.getByRole("button", { name: "tags.create" }));

    await vi.waitFor(() => expect(onTagCreated).toHaveBeenCalledWith({ name: "movies", color: "#3b82f6" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides the name field and pre-fills the color when editing", () => {
    render(
      <AddTagModal
        open
        onOpenChange={vi.fn()}
        onTagCreated={vi.fn()}
        editingTag={editingTag}
        onTagUpdated={vi.fn()}
      />
    );

    expect(screen.queryByLabelText("tags.fields.name *")).not.toBeInTheDocument();
    expect(screen.getByText("movies")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "common.save" })).toBeInTheDocument();
  });

  it("calls onTagUpdated with only the color when editing", async () => {
    const onTagUpdated = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <AddTagModal
        open
        onOpenChange={onOpenChange}
        onTagCreated={vi.fn()}
        editingTag={editingTag}
        onTagUpdated={onTagUpdated}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "common.save" }));

    await vi.waitFor(() => expect(onTagUpdated).toHaveBeenCalledWith("tag-1", { color: "#ff0000" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows an error toast when submission throws", async () => {
    const onTagCreated = vi.fn().mockRejectedValue(new Error("boom"));
    render(<AddTagModal open onOpenChange={vi.fn()} onTagCreated={onTagCreated} />);

    fireEvent.change(screen.getByLabelText("tags.fields.name *"), { target: { value: "movies" } });
    fireEvent.click(screen.getByRole("button", { name: "tags.create" }));

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
  });
});
