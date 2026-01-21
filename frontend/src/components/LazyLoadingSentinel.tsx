import { Loader2 } from "lucide-react";
import { forwardRef } from "react";

interface LazyLoadingSentinelProps {
  show: boolean;
}

export const LazyLoadingSentinel = forwardRef<HTMLDivElement, LazyLoadingSentinelProps>(
  ({ show }, ref) => {
    if (!show) return null;

    return (
      <div ref={ref} className="flex items-center justify-center py-4">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
);

LazyLoadingSentinel.displayName = "LazyLoadingSentinel";
