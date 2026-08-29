/**
 * QueueRankBadge component
 *
 * Shows a torrent's position in qBittorrent's own download queue
 * (Task.priority: 1 = top, -1 when queueing is disabled on the instance).
 */

import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function QueueRankBadge({ priority }: { priority?: number }) {
  const { t } = useTranslation();

  if (!priority || priority <= 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center justify-center min-w-[24px] px-1.5 py-0.5 rounded-md text-[10px] font-medium border leading-none text-muted-foreground border-muted-foreground/30 tabular-nums">
          #{priority}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {t("torrents.queueRank", { defaultValue: "Queue position #{{position}}", position: priority })}
      </TooltipContent>
    </Tooltip>
  );
}
