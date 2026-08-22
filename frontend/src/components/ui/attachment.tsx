import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface AttachmentProps extends React.ComponentProps<"button"> {
  description?: React.ReactNode
  icon?: React.ReactNode
  onRemove?: () => void
  removeLabel?: string
  selected?: boolean
}

function Attachment({
  children,
  className,
  description,
  icon,
  onRemove,
  removeLabel = "Remove attachment",
  selected = false,
  type = "button",
  ...props
}: AttachmentProps) {
  if (selected) {
    return (
      <div
        data-slot="attachment"
        className={cn(
          "flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4 shadow-sm",
          className
        )}
      >
        {icon && (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground">
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-lg font-medium text-foreground">{children}</span>
          {description && <span className="block text-sm text-muted-foreground">{description}</span>}
        </div>
        {onRemove && (
          <button
            type="button"
            aria-label={removeLabel}
            className="shrink-0 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            onClick={onRemove}
            disabled={props.disabled}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    )
  }

  return (
    <button
      type={type}
      data-slot="attachment"
      className={cn(
        "group flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 px-4 py-5 text-center transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {icon && <span className="text-muted-foreground transition-colors group-hover:text-primary">{icon}</span>}
      <span className="break-all text-sm font-medium text-foreground">{children}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </button>
  )
}

export { Attachment }
