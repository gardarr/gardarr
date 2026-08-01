interface ProgressBarProps {
    progress: number;
    showLabel?: boolean;
    height?: "sm" | "md" | "lg";
    className?: string;
    variant?: "primary" | "gray";
  }

  export function ProgressBar({ 
    progress, 
    showLabel = false, 
    height = "md",
    className = "",
    variant = "primary"
  }: ProgressBarProps) {
    const heightClasses = {
      sm: "h-1.5",
      md: "h-2",
      lg: "h-3"
    };

    const colorClasses = {
      primary: "bg-primary",
      gray: "bg-gray-400 dark:bg-gray-500"
    };
  
    return (
      <div className={className}>
        <div className={`w-full rounded-full ${heightClasses[height]} ${variant === "primary" ? "torrent-progress-track" : "bg-secondary"}`}>
          <div 
            className={`${variant === "primary" ? "torrent-progress-fill" : colorClasses[variant]} ${heightClasses[height]} rounded-full transition-all duration-300`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          ></div>
        </div>
        {showLabel && (
          <div className="text-xs text-muted-foreground mt-1">
            {progress.toFixed(1)}% concluído
          </div>
        )}
      </div>
    );
  }
