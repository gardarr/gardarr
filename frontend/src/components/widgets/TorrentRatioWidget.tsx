import { ArrowUpDown, Activity, Share2, TrendingUp, Upload } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRatioGrade, getGradeColor, getGradeStars, getGradeGlowClass, getGradeDescription, getGradeMessage } from "@/utils/ratioUtils";
import { useTranslation } from "react-i18next";
import { formatBytes } from "@/utils/bytes";

interface TorrentRatioWidgetProps {
  ratio: number;
  popularity: number;
  totalUploaded?: number;
  onShare?: () => void;
}

export function TorrentRatioWidget({ ratio, popularity, totalUploaded, onShare }: Readonly<TorrentRatioWidgetProps>) {
  const { t } = useTranslation();
  const grade = getRatioGrade(ratio);
  const colorClass = getGradeColor(grade);
  const stars = getGradeStars(grade);
  const glowClass = getGradeGlowClass(grade);
  const baseGrade = grade.replace(/\+/g, "");
  const plusCount = grade.length - baseGrade.length;
  const message = getGradeMessage(grade);
  const content = (
    <>
      <div className="flex items-center justify-between gap-2 mb-0">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4" />
          <h4 className="text-xs font-medium uppercase tracking-wide">{t("ratio.widget.title", { defaultValue: "Ratio" })}</h4>
        </div>
        {onShare && <Share2 className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Activity className="h-3 w-3 opacity-70" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-base md:text-lg font-semibold opacity-90">{ratio.toFixed(2)}x</span>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{t("ratio.widget.ratioTooltip", { defaultValue: "Razão Seeders/Leechers. Quanto maior, melhor." })}</span>
                </TooltipContent>
              </Tooltip>
            </div>
            {totalUploaded !== undefined && (
              <div className="flex items-center gap-2">
                <Upload className="h-3 w-3 opacity-70" />
                <span className="text-sm opacity-80 font-mono">{formatBytes(totalUploaded)}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 opacity-70" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm opacity-80">{Number(popularity).toFixed(2)}</span>
                </TooltipTrigger>
                <TooltipContent>
                  <span>{t("ratio.widget.popularityTooltip", { defaultValue: "Relative torrent popularity. Higher means more popular." })}</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="w-px self-stretch bg-current/20 opacity-40" aria-hidden="true" />
        <div className="flex-1 flex items-center justify-center px-2">
          <span className="text-[10px] md:text-xs opacity-80 text-center leading-snug">{message}</span>
        </div>
        <div className="w-px self-stretch bg-current/20 opacity-40" aria-hidden="true" />
        <div className="flex-1 flex justify-center">
          <div className="select-none leading-none flex flex-col items-center gap-1 text-center">
            <span className={`text-6xl md:text-7xl font-black tracking-tight opacity-90 ${glowClass}`}>
              {baseGrade}
              {plusCount > 0 && (
                <sup className="relative -top-2 ml-0.5 text-xl md:text-2xl leading-none">{"+".repeat(plusCount)}</sup>
              )}
            </span>
            <div className="flex items-center" aria-label={t("ratio.widget.starsAria", { stars, total: 5, defaultValue: `${stars} out of 5 stars` })}>
              {Array.from({ length: 5 }).map((_, idx) => (
                <svg
                  key={idx}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className={`w-3.5 h-3.5 ${idx < stars ? '' : 'opacity-30'}`}
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.802 2.036a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.539 1.118l-2.802-2.036a1 1 0 00-1.176 0l-2.802 2.036c-.783.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.88 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-[10px] md:text-xs uppercase tracking-wide opacity-80">{getGradeDescription(grade)}</span>
          </div>
        </div>
      </div>
    </>
  );

  const className = `p-3 rounded-lg border ${colorClass}`;
  if (!onShare) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      className={`${className} w-full cursor-pointer bg-transparent text-left transition-[filter,transform] hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]`}
      aria-label={t("torrentDetails.shareCard.openFromRatio")}
      onClick={onShare}
    >
      {content}
    </button>
  );
}
