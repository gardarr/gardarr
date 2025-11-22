import { cn } from "@/lib/utils";

interface LoadingBarProps {
  className?: string;
}

export function LoadingBar({ className }: LoadingBarProps) {
  return (
    <div className={cn("w-full h-1 bg-muted overflow-hidden", className)}>
      <div className="h-full bg-primary animate-loading-bar" />
    </div>
  );
}

