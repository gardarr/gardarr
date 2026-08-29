import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

// Same visual shell as TorrentRatioWidget (p-3 rounded-lg border + uppercase
// micro-header), in neutral colors so grade-colored cards stand out.
export function DetailCard({ icon: Icon, title, action, className, children }: DetailCardProps) {
  return (
    <div className={cn("flex h-full flex-col p-3 container-content-background/50 rounded-lg border", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h4>
        </div>
        {action}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
