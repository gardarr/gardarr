import { useId } from "react";
import { Share2, Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ModeButtonGroup } from "@/components/ModeButtonGroup";
import type { LimitMode } from "@/utils/limitUtils";
import type { TaskLimits } from "@/types/torrent";
import { formatMinutes } from "@/utils/timeUtils";

interface ShareLimitControlProps {
  limits: TaskLimits;
  ratioLimitMode: LimitMode;
  seedingTimeLimitMode: LimitMode;
  inactiveSeedingTimeLimitMode: LimitMode;
  onLimitChange: (field: keyof TaskLimits, value: string) => void;
  onRatioLimitModeChange: (mode: LimitMode) => void;
  onSeedingTimeLimitModeChange: (mode: LimitMode) => void;
  onInactiveSeedingTimeLimitModeChange: (mode: LimitMode) => void;
}

export function ShareLimitControl({
  limits,
  ratioLimitMode,
  seedingTimeLimitMode,
  inactiveSeedingTimeLimitMode,
  onLimitChange,
  onRatioLimitModeChange,
  onSeedingTimeLimitModeChange,
  onInactiveSeedingTimeLimitModeChange,
}: ShareLimitControlProps) {
  return (
    <div className="space-y-4 pt-4 border-t">
      <h3 className="text-lg font-semibold">Share Limits</h3>

      <RatioLimitField
        limits={limits}
        mode={ratioLimitMode}
        onModeChange={onRatioLimitModeChange}
        onLimitChange={onLimitChange}
      />

      <SeedingTimeLimitField
        limits={limits}
        mode={seedingTimeLimitMode}
        onModeChange={onSeedingTimeLimitModeChange}
        onLimitChange={onLimitChange}
        label="Seeding Time Limit (minutes)"
        field="seeding_time_limit"
        helpText="Set a custom seeding time limit in minutes (>= 0)"
      />

      <SeedingTimeLimitField
        limits={limits}
        mode={inactiveSeedingTimeLimitMode}
        onModeChange={onInactiveSeedingTimeLimitModeChange}
        onLimitChange={onLimitChange}
        label="Inactive Seeding Time Limit (minutes)"
        field="inactive_seeding_time_limit"
        helpText="Set a custom inactive seeding time limit in minutes (>= 0)"
      />
    </div>
  );
}

interface RatioLimitFieldProps {
  limits: TaskLimits;
  mode: LimitMode;
  onModeChange: (mode: LimitMode) => void;
  onLimitChange: (field: keyof TaskLimits, value: string) => void;
}

function RatioLimitField({
  limits,
  mode,
  onModeChange,
  onLimitChange,
}: RatioLimitFieldProps) {
  const inputId = useId();
  const getHelpText = () => {
    if (mode === "global") return "Use global limit";
    if (mode === "unlimited") return "No limit";
    return "Set a custom ratio value (>= 0)";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Ratio Limit
        </Label>
        <ModeButtonGroup mode={mode} onModeChange={onModeChange} />
      </div>
      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            type="number"
            min="0"
            step="0.1"
            value={limits.ratio_limit >= 0 ? limits.ratio_limit : ""}
            onChange={(e) => onLimitChange("ratio_limit", e.target.value)}
            placeholder="Ratio value"
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {limits.ratio_limit >= 0 ? `Ratio: ${limits.ratio_limit.toFixed(1)}` : "Ratio:"}
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{getHelpText()}</p>
    </div>
  );
}

interface SeedingTimeLimitFieldProps {
  limits: TaskLimits;
  mode: LimitMode;
  onModeChange: (mode: LimitMode) => void;
  onLimitChange: (field: keyof TaskLimits, value: string) => void;
  label: string;
  field: "seeding_time_limit" | "inactive_seeding_time_limit";
  helpText: string;
}

function SeedingTimeLimitField({
  limits,
  mode,
  onModeChange,
  onLimitChange,
  label,
  field,
  helpText,
}: SeedingTimeLimitFieldProps) {
  const inputId = useId();
  const getHelpText = () => {
    if (mode === "global") return "Use global limit";
    if (mode === "unlimited") return "No limit";
    return helpText;
  };

  const limitValue = limits[field];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={inputId} className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {label}
        </Label>
        <ModeButtonGroup mode={mode} onModeChange={onModeChange} />
      </div>
      {mode === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            id={inputId}
            type="number"
            min="0"
            step="1"
            value={limitValue >= 0 ? limitValue : ""}
            onChange={(e) => onLimitChange(field, e.target.value)}
            placeholder="Minutes"
            className="flex-1"
          />
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {formatMinutes(limitValue >= 0 ? limitValue : 0)}
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{getHelpText()}</p>
    </div>
  );
}

