import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueueRankBadge } from "../QueueRankBadge";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string; position?: number }) =>
      (opts?.defaultValue ?? key).replace("{{position}}", String(opts?.position ?? "")),
  }),
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("QueueRankBadge", () => {
  it("renders nothing when priority is undefined", () => {
    const { container } = render(<QueueRankBadge priority={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when priority is 0", () => {
    const { container } = render(<QueueRankBadge priority={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when priority is -1 (queueing disabled)", () => {
    const { container } = render(<QueueRankBadge priority={-1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the rank and a tooltip with the position when priority is positive", () => {
    render(<QueueRankBadge priority={3} />);
    expect(screen.getByText("#3")).toBeInTheDocument();
    expect(screen.getByText("Queue position #3")).toBeInTheDocument();
  });
});
