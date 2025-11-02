import { Clock, CheckCircle2, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Task } from "@/types/torrent";
import { useTranslation } from "react-i18next";

interface TorrentLifetimeWidgetProps {
  task: Task;
}

interface TimelinePoint {
  date: Date;
  label: string;
  icon: React.ReactNode;
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
      icon: <Calendar className="h-4 w-4" />,
      status: "completed",
    },
  ];

  if (completedAt) {
    points.push({
      date: completedAt,
      label: t("torrent.completed"),
      icon: <CheckCircle2 className="h-4 w-4" />,
      status: "completed",
    });
  }

  points.push({
    date: now,
    label: t("torrent.now"),
    icon: <Clock className="h-4 w-4" />,
    status: "current",
  });

  // Calculate total duration
  const totalDuration = now.getTime() - createdAt.getTime();
  const completedDuration = completedAt ? completedAt.getTime() - createdAt.getTime() : null;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString(i18n.language, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
    <div className="p-3 container-content-background/50 rounded-lg border">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {t("torrent.timeline")}
        </h4>
      </div>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-0 right-0 top-6 h-0.5 bg-border" />

        {/* Timeline points */}
        <div className="relative flex items-start justify-between gap-4">
          {points.map((point, index) => {

            return (
              <div
                key={index}
                className="flex flex-col items-center flex-1 min-w-0"
                style={{
                  maxWidth: index === points.length - 1 ? "auto" : "calc(50% - 1rem)",
                }}
              >
                {/* Timeline dot */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative z-10 flex items-center justify-center transition-all",
                        point.status === "completed" && "text-primary",
                        point.status === "current" && "text-green-600 animate-pulse",
                        point.status === "future" && "text-muted-foreground"
                      )}
                    >
                      {point.icon}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <p className="font-semibold">{point.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(point.date)}
                      </p>
                      {index > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDuration(point.date.getTime() - points[index - 1].date.getTime())}{" "}
                          {t("torrent.after")}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>

                {/* Label */}
                <div className="mt-2 text-center min-w-0">
                  <p
                    className={cn(
                      "text-xs font-medium truncate",
                      point.status === "current" && "text-green-600",
                      point.status === "completed" && "text-primary",
                      point.status === "future" && "text-muted-foreground"
                    )}
                  >
                    {point.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {formatDate(point.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Duration info */}
        <div className="mt-4 pt-3 border-t flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <span>{t("torrent.total")}:</span>
            <span className="font-mono font-medium">{formatDuration(totalDuration)}</span>
          </div>
          {completedAt && completedDuration && (
            <div className="flex items-center gap-1">
              <span>{t("torrent.download")}:</span>
              <span className="font-mono font-medium">
                {formatDuration(completedDuration)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
