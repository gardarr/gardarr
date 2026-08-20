import { Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseTag } from "@/utils/tagRules";
import { useTagColors } from "@/contexts/tag-colors-hooks";

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
  const { getTagColor, getScopeColor } = useTagColors();

  if (parsed.kind === "scoped") {
    // The key half always uses the scope's shared color, so every
    // "key::*" badge reads as one hue at a glance; the value half prefers
    // its own exact override and otherwise falls back to that same color.
    const scopeColor = getScopeColor(parsed.key);
    const valueColor = getTagColor(parsed.raw) ?? scopeColor;

    return (
      <div className={cn("inline-flex items-center", className)}>
        {/* Category badge */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-l-full font-medium",
            scopeColor ? "text-white" : "bg-primary text-primary-foreground border border-primary",
            sizeClasses[size]
          )}
          style={scopeColor ? { backgroundColor: scopeColor } : undefined}
        >
          {showIcon && <Tag className={iconSizes[size]} />}
          {parsed.key}
        </span>

        {/* Value badge - a shade darker than the key half when both share the scope color */}
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-r-full font-medium",
            valueColor ? "text-white" : "bg-secondary text-secondary-foreground border border-secondary",
            "border-l-0",
            sizeClasses[size]
          )}
          style={valueColor ? { backgroundColor: valueColor, filter: "brightness(0.82)" } : undefined}
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

  const plainColor = getTagColor(parsed.raw);

  // Regular single tag
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        plainColor ? "text-white" : "bg-primary text-primary-foreground border border-primary",
        sizeClasses[size],
        className
      )}
      style={plainColor ? { backgroundColor: plainColor } : undefined}
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
