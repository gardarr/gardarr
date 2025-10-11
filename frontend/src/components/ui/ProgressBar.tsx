interface ProgressBarProps {
    progress: number;
    showLabel?: boolean;
    height?: "sm" | "md" | "lg";
    className?: string;
  }
  
  export function ProgressBar({ 
    progress, 
    showLabel = true, 
    height = "md",
    className = "" 
  }: ProgressBarProps) {
    const heightClasses = {
      sm: "h-1.5",
      md: "h-2",
      lg: "h-3"
    };
  
    return (
      <div className={className}>
        <div className={`w-full bg-secondary rounded-full ${heightClasses[height]}`}>
          <div 
            className={`bg-primary ${heightClasses[height]} rounded-full transition-all duration-300`}
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
  