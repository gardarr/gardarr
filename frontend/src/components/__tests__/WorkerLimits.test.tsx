import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkerLimits } from "@/components/WorkerLimits";

const getWorkerPreferences = vi.fn();
const getSchedulePreview = vi.fn();

vi.mock("@/services/workers", () => ({
  workerService: {
    getWorkerPreferences: (...args: unknown[]) => getWorkerPreferences(...args),
    getSchedulePreview: (...args: unknown[]) => getSchedulePreview(...args),
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, values?: { name?: string }) =>
      fallback?.replace("{{name}}", values?.name ?? "") ?? key,
  }),
}));
vi.mock("lucide-react", () => ({
  AlertTriangle: () => <span />,
  Loader2: () => <span />,
  Save: () => <span />,
  Download: () => <span />,
  Upload: () => <span />,
}));
vi.mock("@/components/ui/button", () => ({ Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button> }));
vi.mock("@/components/ui/input", () => ({ Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} /> }));
vi.mock("@/components/ui/label", () => ({ Label: ({ children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label> }));
vi.mock("@/components/ui/slider", () => ({ Slider: () => <span /> }));
vi.mock("@/components/ui/scroll-area", () => ({ ScrollArea: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/ui/alert", () => ({ Alert: ({ children }: { children: ReactNode }) => <div role="alert">{children}</div>, AlertTitle: ({ children }: { children: ReactNode }) => <p>{children}</p>, AlertDescription: ({ children }: { children: ReactNode }) => <p>{children}</p> }));
vi.mock("@/components/ui/QBittorrentIcon", () => ({ QBittorrentIcon: () => <span /> }));
vi.mock("@/components/ui/tooltip", () => ({ TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>, Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>, TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>, TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</> }));

describe("WorkerLimits", () => {
  it("warns that a manual limit is temporary while a schedule is active", async () => {
    getWorkerPreferences.mockResolvedValue({ data: { global_rate_limits: { download_speed_limit: 0, upload_speed_limit: 0 }, active_torrent_limits: { max_active_downloads: 1, max_active_uploads: 1, max_active_torrents: 1, max_active_checking_torrents: 1 } } });
    getSchedulePreview.mockResolvedValue({ data: { source: "schedule", schedule: { name: "Weekday cap" } } });

    render(<WorkerLimits workerId="worker-1" />);

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("A speed schedule is active")).toBeInTheDocument();
    expect(screen.getByText(/Weekday cap.*temporary until the next schedule transition/i)).toBeInTheDocument();
  });
});
