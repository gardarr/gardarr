import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/utils/bytes";
import { useTranslation } from "react-i18next";
import type { PendingTorrent } from "@/contexts/add-torrent-context";

export type TorrentPlaceholderVariant = "table" | "card" | "card_b" | "list";

interface TorrentPlaceholderCardProps {
  pending: PendingTorrent;
  variant: TorrentPlaceholderVariant;
}

function AddingBadge() {
  const { t } = useTranslation();

  return (
    <span className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t("torrents.pendingCard.adding")}
    </span>
  );
}

export function TorrentPlaceholderCard({ pending, variant }: TorrentPlaceholderCardProps) {
  const isCompactRow = variant === "table" || variant === "list";

  if (isCompactRow) {
    return (
      <div className="relative flex flex-col overflow-hidden rounded-lg border bg-card px-4 py-2.5 animate-pulse">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 flex-shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">{pending.name}</span>
              <AddingBadge />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {pending.size ? <span>{formatBytes(pending.size)}</span> : <Skeleton className="h-3 w-14" />}
              <span className="truncate">{pending.category}</span>
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="hidden h-3 w-24 sm:block" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-xl border bg-card p-3 animate-pulse">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium text-foreground">{pending.name}</span>
        <AddingBadge />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {pending.size ? <span>{formatBytes(pending.size)}</span> : <Skeleton className="h-3 w-14" />}
        <span className="truncate">{pending.category}</span>
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
