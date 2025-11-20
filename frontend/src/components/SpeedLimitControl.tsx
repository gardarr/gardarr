import { useId } from "react";
import { Download, Upload, Infinity as InfinityIcon } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatBytes, SPEED_LIMIT_SEGMENTS, bytesToSliderIndex, sliderIndexToBytes } from "@/utils/bytes";
import type { TaskLimits } from "@/types/torrent";
import type { TaskStatus } from "@/utils/statusUtils";
import { isDownloadStatus, isUploadStatus } from "@/utils/statusUtils";

interface SpeedLimitControlProps {
  limits: TaskLimits;
  isAdvancedMode: boolean;
  taskStatus: TaskStatus | null;
  onLimitChange: (field: keyof TaskLimits, value: string) => void;
  onAdvancedModeChange: (enabled: boolean) => void;
  mixedFields?: Partial<Record<keyof TaskLimits, boolean>>;
}

export function SpeedLimitControl({
  limits,
  isAdvancedMode,
  taskStatus,
  onLimitChange,
  onAdvancedModeChange,
  mixedFields = {},
}: SpeedLimitControlProps) {
  const shouldShowSpeedLimits = taskStatus === null || isDownloadStatus(taskStatus) || isUploadStatus(taskStatus);

  if (!shouldShowSpeedLimits) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Speed Limits</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Advanced</span>
          <Switch checked={isAdvancedMode} onCheckedChange={(checked) => onAdvancedModeChange(checked)} />
        </div>
      </div>

      {(taskStatus === null || isDownloadStatus(taskStatus)) && (
        <SpeedLimitField
          label="Download Limit"
          icon={<Download className="h-4 w-4" />}
          limit={limits.download_limit}
          isAdvancedMode={isAdvancedMode}
          onLimitChange={(value) => onLimitChange("download_limit", value)}
          helpText="Move slider to maximum for unlimited download speed"
          isMixed={mixedFields.download_limit}
        />
      )}

      {(taskStatus === null || isUploadStatus(taskStatus)) && (
        <SpeedLimitField
          label="Upload Limit"
          icon={<Upload className="h-4 w-4" />}
          limit={limits.upload_limit}
          isAdvancedMode={isAdvancedMode}
          onLimitChange={(value) => onLimitChange("upload_limit", value)}
          helpText="Move slider to maximum for unlimited upload speed"
          isMixed={mixedFields.upload_limit}
        />
      )}
    </div>
  );
}

interface SpeedLimitFieldProps {
  label: string;
  icon: React.ReactNode;
  limit: number;
  isAdvancedMode: boolean;
  onLimitChange: (value: string) => void;
  helpText: string;
  isMixed?: boolean;
}

function SpeedLimitField({
  label,
  icon,
  limit,
  isAdvancedMode,
  onLimitChange,
  helpText,
  isMixed,
}: SpeedLimitFieldProps) {
  const inputId = useId();

  return (
    <div className="space-y-3">
      <Label htmlFor={inputId} className="flex items-center gap-2">
        {icon}
        <span>{label}</span>
        <span className="h-1 w-1 rounded-full bg-muted-foreground"></span>
        {isMixed ? (
          <span className="text-sm font-bold text-muted-foreground italic">Mixed</span>
        ) : limit === 0 ? (
          <span className="text-sm font-bold text-primary flex items-center gap-1">
            Unlimited
            <InfinityIcon className="h-4 w-4" />
          </span>
        ) : (
          <span className="text-sm font-bold text-primary">{formatBytes(limit)}/s</span>
        )}
      </Label>
      <div className="space-y-2">
        <Slider
          value={isMixed ? [0] : [bytesToSliderIndex(limit)]}
          onValueChange={(value) => {
            const bytes = sliderIndexToBytes(value[0]);
            onLimitChange(bytes.toString());
          }}
          min={1}
          max={SPEED_LIMIT_SEGMENTS.length + 1}
          step={1}
          className="w-full"
          disabled={isMixed} // Disable slider if mixed until user interacts via input or we decide how to handle slider interaction on mixed
        />
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>{formatBytes(SPEED_LIMIT_SEGMENTS[0])}/s</span>
          <span>Unlimited</span>
        </div>
      </div>
      {isAdvancedMode && (
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            type={isMixed ? "text" : "number"}
            min="0"
            step="1"
            value={isMixed ? "" : (limit === 0 ? "" : limit)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onLimitChange("");
                return;
              }
              const parsed = Number(raw);
              if (!Number.isFinite(parsed)) {
                return;
              }
              const clamped = Math.max(0, Math.floor(parsed));
              onLimitChange(String(clamped));
            }}
            placeholder={isMixed ? "Mixed values" : "0 = unlimited"}
            className="flex-1"
          />
          {!isMixed && limit > 0 && (
            <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] text-right">
              ({formatBytes(limit)}/s)
            </span>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{helpText}</p>
    </div>
  );
}

