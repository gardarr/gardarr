import { Play, Pause, Zap, Radio, CheckCircle, Trash2, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface TorrentActionBarProps {
  torrentId: string;
  onPlay?: (torrentId: string) => void;
  onPause?: (torrentId: string) => void;
  onForceDownload?: (torrentId: string) => void;
  onForceReannounce?: (torrentId: string) => void;
  onForceRecheck?: (torrentId: string) => void;
  onDelete?: () => void;
}

interface ActionDefinition {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  className?: string;
}

export function TorrentActionBar({
  torrentId,
  onPlay,
  onPause,
  onForceDownload,
  onForceReannounce,
  onForceRecheck,
  onDelete,
}: TorrentActionBarProps) {
  const { t } = useTranslation();

  const actions: ActionDefinition[] = [];

  if (onPlay) {
    actions.push({
      icon: Play,
      label: t("torrents.actionButtons.play"),
      onClick: () => onPlay(torrentId),
    });
  }
  if (onPause) {
    actions.push({
      icon: Pause,
      label: t("torrents.actionButtons.pause"),
      onClick: () => onPause(torrentId),
    });
  }
  if (onForceDownload) {
    actions.push({
      icon: Zap,
      label: t("torrentDetails.actions.forceDownload", { defaultValue: "Force Download" }),
      onClick: () => onForceDownload(torrentId),
      className: "text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 dark:text-orange-400 dark:hover:text-orange-300",
    });
  }
  if (onForceReannounce) {
    actions.push({
      icon: Radio,
      label: t("torrentDetails.actions.forceReannounce", { defaultValue: "Force Reannounce" }),
      onClick: () => onForceReannounce(torrentId),
      className: "text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 dark:text-blue-400 dark:hover:text-blue-300",
    });
  }
  if (onForceRecheck) {
    actions.push({
      icon: CheckCircle,
      label: t("torrentDetails.actions.forceRecheck", { defaultValue: "Force Recheck" }),
      onClick: () => onForceRecheck(torrentId),
      className: "text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950 dark:text-purple-400 dark:hover:text-purple-300",
    });
  }
  if (onDelete) {
    actions.push({
      icon: Trash2,
      label: t("torrents.actionButtons.delete"),
      onClick: onDelete,
      className: "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 dark:text-red-400 dark:hover:text-red-300",
    });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
      <ButtonGroup className="flex-shrink-0">
        {actions.map(({ icon: Icon, label, onClick, className }) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={onClick}
                className={`h-10 w-10 flex-shrink-0 ${className ?? ""}`}
                aria-label={label}
              >
                <Icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </ButtonGroup>
    </div>
  );
}
