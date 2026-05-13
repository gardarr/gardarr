import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getStatusIcon, getStatusColor, type TorrentStatus } from "@/components/torrents/TorrentStatusIcon";
import { getStatusTranslationKey } from "@/utils/statusUtils";
import { useTranslation } from "react-i18next";

interface StatusBadgeProps {
  status: TorrentStatus;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({ 
  status, 
  size = "md", 
  showTooltip = true,
  showLabel = false,
  className = "" 
}: StatusBadgeProps) {
  const { t } = useTranslation();
  const StatusIcon = getStatusIcon(status);
  
  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5"
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base"
  };

  const content = showLabel ? (
    <div className="flex items-center gap-2">
      <StatusIcon 
        className={`${sizeClasses[size]} flex-shrink-0 ${getStatusColor(status)} ${className}`} 
      />
      <span className={`${textSizeClasses[size]} ${getStatusColor(status)} font-medium`}>
        {t(getStatusTranslationKey(status))}
      </span>
    </div>
  ) : (
    <StatusIcon 
      className={`${sizeClasses[size]} flex-shrink-0 ${getStatusColor(status)} ${className}`} 
    />
  );

  if (!showTooltip || showLabel) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex">
          {content}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{t(getStatusTranslationKey(status))}</p>
      </TooltipContent>
    </Tooltip>
  );
}
