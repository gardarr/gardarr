import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/torrent";
import { useTranslation } from "react-i18next";

interface TorrentLifetimeWidgetProps {
  task: Task;
}

interface TimelinePoint {
  date: Date;
  label: string;
  status: "completed" | "current" | "future";
}

export function TorrentLifetimeWidget({ task }: TorrentLifetimeWidgetProps) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const createdAt = new Date(task.created_at);
  const completedAt = task.completed_at ? new Date(task.completed_at) : null;

  // Build timeline points
  const points: TimelinePoint[] = [
    {
      date: createdAt,
      label: t("torrent.created"),
      status: "completed",
    },
  ];

  if (completedAt) {
    points.push({
      date: completedAt,
      label: t("torrent.completed"),
      status: "completed",
    });
  }

  points.push({
    date: now,
    label: t("torrent.now"),
    status: "current",
  });

  // Calculate total duration
  const totalDuration = now.getTime() - createdAt.getTime();
  const completedDuration = completedAt ? completedAt.getTime() - createdAt.getTime() : null;

  // Calculate progress for the progressbar
  // Progressbar always goes from Created (0%) to Now (100%)
  // Progressbar always goes to 100% (Now is always the last point)
  const progressPercentage = 100;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} ${t("duration.day", { count: days })}`;
    } else if (hours > 0) {
      return `${hours} ${t("duration.hour", { count: hours })}`;
    } else if (minutes > 0) {
      return `${minutes} ${t("duration.minute", { count: minutes })}`;
    }
    return `${seconds} ${t("duration.second", { count: seconds })}`;
  };

  return (
    <div className="p-2.5 container-content-background/50 rounded-lg border">
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("torrent.timeline")}
        </h4>
      </div>

      <div className="relative">
        {/* Timeline points - a grid with one equal-width column per point, so
            each bullet centers exactly at its column's midpoint, matching
            the progressbar math below (which assumes evenly spaced points). */}
        <div
          className="relative grid gap-4 items-start"
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {/* Timeline progressbar background - positioned absolutely to span from first to last icon center */}
          <div
            className="absolute h-px bg-secondary pointer-events-none"
            style={{
              top: '0.25rem', // Center of 0.5rem (h-2) bullets
              left: `calc(${100 / (points.length * 2)}%)`,
              right: `calc(${100 / (points.length * 2)}%)`,
            }}
          />

          {/* Timeline progressbar fill. While the torrent hasn't finished
              downloading yet, this only spans Created -> Now, animates as a
              right-moving diagonal stripe, and the whole stripe pattern (via
              mask-image, not just the gaps) fades to transparent, since that
              stretch isn't a settled duration. */}
          <div
            className={cn(
              "absolute rounded-full transition-all duration-300 pointer-events-none",
              completedAt ? "h-px bg-primary" : "h-1 animate-progress-stripes"
            )}
            style={{
              top: completedAt ? '0.25rem' : '0.125rem', // Center of 0.5rem (h-2) bullets
              left: `calc(${100 / (points.length * 2)}%)`,
              width: `calc((100% - ${100 / points.length}%) * ${progressPercentage} / 100)`,
              backgroundImage: completedAt
                ? undefined
                : 'repeating-linear-gradient(45deg, var(--primary) 0, var(--primary) 25%, transparent 25%, transparent 50%)',
              backgroundSize: completedAt ? undefined : '0.75rem 0.75rem',
              backgroundRepeat: completedAt ? undefined : 'repeat',
              // Fades the whole stripe pattern (not just the gaps between
              // stripes) toward transparent as it approaches "Now".
              WebkitMaskImage: completedAt ? undefined : 'linear-gradient(to right, black, transparent)',
              maskImage: completedAt ? undefined : 'linear-gradient(to right, black, transparent)',
            }}
          />

          {points.map((point) => {

            return (
              <div key={point.label} className="flex flex-col items-center min-w-0">
                {/* Timeline bullet */}
                <div
                  className={cn(
                    "relative z-10 w-2 h-2 rounded-full transition-all",
                    point.status === "completed" && "bg-primary",
                    point.status === "current" && "bg-primary animate-pulse",
                    point.status === "future" && "bg-muted"
                  )}
                />

                {/* Label + date on a single line to keep the widget short */}
                <div className="mt-1 text-center min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      point.status === "current" && "text-primary",
                      point.status === "completed" && "text-primary",
                      point.status === "future" && "text-muted-foreground"
                    )}
                  >
                    {point.label}
                    <span className="text-[10px] font-normal text-muted-foreground">
                      {" · "}{formatDate(point.date)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Duration info */}
        <div className="mt-2 pt-2 border-t flex justify-between items-center text-xs text-muted-foreground">
          {completedAt && completedDuration && (
            <div className="flex items-center gap-1">
              <span>{t("torrent.download")}:</span>
              <span className="font-mono font-medium">
                {formatDuration(completedDuration)}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <span>{t("torrent.total")}:</span>
            <span className="font-mono font-medium">{formatDuration(totalDuration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
