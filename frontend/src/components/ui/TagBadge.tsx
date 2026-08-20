import { Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTag } from "@/utils/tagRules";

interface TagBadgeProps {
  tag: string;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  showDelete?: boolean;
  onDelete?: () => void;
}

export function TagBadge({ 
  tag, 
  className, 
  showIcon = true, 
  size = "sm",
  showDelete = false,
  onDelete
}: TagBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5"
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5", 
    lg: "h-4 w-4"
  };

  const parsed = parseTag(tag);

  if (parsed.kind === "scoped") {
    return (
      <div className={cn("inline-flex items-center", className)}>
        {/* Category badge - primary theme */}
        <span
          className={cn(
            "inline-flex items-center gap-1 bg-primary text-primary-foreground border border-primary rounded-l-full font-medium",
            sizeClasses[size]
          )}
        >
          {showIcon && <Tag className={iconSizes[size]} />}
          {parsed.key}
        </span>
        
        {/* Value badge - secondary theme */}
        <span
          className={cn(
            "inline-flex items-center gap-1 bg-secondary text-secondary-foreground border border-secondary rounded-r-full font-medium border-l-0",
            sizeClasses[size]
          )}
        >
          {parsed.value}
          {showDelete && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="ml-1 hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>
    );
  }

  // Regular single tag
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 bg-primary text-primary-foreground border border-primary rounded-full font-medium",
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Tag className={iconSizes[size]} />}
      {parsed.raw}
      {showDelete && onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="ml-1 hover:text-destructive transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
