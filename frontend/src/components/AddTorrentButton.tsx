import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddTorrentButtonProps = React.ComponentProps<typeof Button> & {
  iconOnly?: boolean;
};

/** Themed add-torrent action with a subtle glow. */
function AddTorrentButton({ className, children, iconOnly = false, ...props }: AddTorrentButtonProps) {
  return (
    <Button
      {...props}
      className={cn(
        "add-torrent-button group relative isolate overflow-hidden border-transparent !bg-transparent cursor-pointer transition-shadow",
        iconOnly && "px-0",
        className,
      )}
    >
      <span
        className="add-torrent-button-surface pointer-events-none absolute inset-px z-0 rounded-[inherit]"
        aria-hidden="true"
      />
      <span
        className={cn(
          "add-torrent-button-label relative z-10 inline-flex items-center",
          iconOnly ? "rounded-full p-1" : "rounded-md px-1.5 py-0.5",
        )}
      >
        <Plus className={cn("h-4 w-4", !iconOnly && "mr-2")} />
        {!iconOnly && children}
      </span>
    </Button>
  );
}

export { AddTorrentButton };
