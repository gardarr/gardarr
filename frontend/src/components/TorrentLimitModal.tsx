import { useState, useEffect, useCallback } from "react";
import { X, Download, Upload, Share2, Save, Globe, Infinity as InfinityIcon, Edit, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { torrentService } from "@/services/torrents";
import type { TaskLimits } from "@/types/torrent";
import { normalizeTaskStatus, isDownloadStatus, isUploadStatus } from "@/utils/statusUtils";
import type { TaskStatus } from "@/utils/statusUtils";
import { formatBytes, SPEED_LIMIT_SEGMENTS, bytesToSliderIndex, sliderIndexToBytes } from "@/utils/bytes";
import { toast } from "sonner";

interface TorrentLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  taskId: string;
  taskName?: string;
  taskStatus?: string;
}

/**
 * Format minutes to human readable format
 */
function formatMinutes(minutes: number): string {
  if (minutes < 0) {
    if (minutes === -2) return "Use global limit";
    if (minutes === -1) return "No limit";
    return `${minutes} minutes`;
  }
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${hours}h ${mins}m`;
}

export function TorrentLimitModal({
  isOpen,
  onClose,
  agentId,
  taskId,
  taskName,
  taskStatus: taskStatusProp
}: TorrentLimitModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limits, setLimits] = useState<TaskLimits>({
    download_limit: 0,
    upload_limit: 0,
    share_limit: 0,
    ratio_limit: 0,
    seeding_time_limit: 0,
    inactive_seeding_time_limit: 0
  });
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [ratioLimitMode, setRatioLimitMode] = useState<"global" | "unlimited" | "custom">("custom");
  const [seedingTimeLimitMode, setSeedingTimeLimitMode] = useState<"global" | "unlimited" | "custom">("custom");
  const [inactiveSeedingTimeLimitMode, setInactiveSeedingTimeLimitMode] = useState<"global" | "unlimited" | "custom">("custom");
  
  // Normalize task status from prop
  const taskStatus: TaskStatus | null = taskStatusProp ? normalizeTaskStatus(taskStatusProp) : null;

  // Load limits when modal opens
  const loadLimits = useCallback(async () => {
    if (!agentId || !taskId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await torrentService.getTaskLimits(agentId, taskId);
      if (response.data) {
        setLimits(response.data);
        // Sync modes based on loaded limits
        if (response.data.ratio_limit === -2) {
          setRatioLimitMode("global");
        } else if (response.data.ratio_limit === -1) {
          setRatioLimitMode("unlimited");
        } else {
          setRatioLimitMode("custom");
        }
        if (response.data.seeding_time_limit === -2) {
          setSeedingTimeLimitMode("global");
        } else if (response.data.seeding_time_limit === -1) {
          setSeedingTimeLimitMode("unlimited");
        } else {
          setSeedingTimeLimitMode("custom");
        }
        if (response.data.inactive_seeding_time_limit === -2) {
          setInactiveSeedingTimeLimitMode("global");
        } else if (response.data.inactive_seeding_time_limit === -1) {
          setInactiveSeedingTimeLimitMode("unlimited");
        } else {
          setInactiveSeedingTimeLimitMode("custom");
        }
      } else {
        setError(response.error || "Failed to load limits");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load limits");
    } finally {
      setIsLoading(false);
    }
  }, [agentId, taskId]);

  useEffect(() => {
    if (isOpen && agentId && taskId) {
      loadLimits();
    }
  }, [isOpen, agentId, taskId, loadLimits]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!agentId || !taskId) return;

    setIsSaving(true);
    setError(null);

    try {
      // Update download limit (only if > 0, since 0 = unlimited)
      if (limits.download_limit > 0) {
        const downloadResponse = await torrentService.setTaskDownloadLimit(agentId, taskId, limits.download_limit);
        if (downloadResponse.error) {
          setError(downloadResponse.error);
          setIsSaving(false);
          return;
        }
      }

      // Update upload limit (only if > 0, since 0 = unlimited)
      if (limits.upload_limit > 0) {
        const uploadResponse = await torrentService.setTaskUploadLimit(agentId, taskId, limits.upload_limit);
        if (uploadResponse.error) {
          setError(uploadResponse.error);
          setIsSaving(false);
          return;
        }
      }

      // Update share limits (ratio, seeding time, inactive seeding time)
      // Send all values including -2 (global) and -1 (unlimited)
      const shareResponse = await torrentService.setTaskShareLimit(
        agentId,
        taskId,
        limits.ratio_limit,
        limits.seeding_time_limit,
        limits.inactive_seeding_time_limit
      );
      if (shareResponse.error) {
        setError(shareResponse.error);
        setIsSaving(false);
        return;
      }

      toast.success("Torrent limits updated successfully");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save limits");
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof TaskLimits, value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    const newValue = isNaN(numValue) ? limits[field] : numValue;
    
    setLimits(prev => ({
      ...prev,
      [field]: newValue
    }));
  };

  const handleRatioLimitModeChange = (mode: "global" | "unlimited" | "custom") => {
    setRatioLimitMode(mode);
    if (mode === "global") {
      setLimits(prev => ({ ...prev, ratio_limit: -2 }));
    } else if (mode === "unlimited") {
      setLimits(prev => ({ ...prev, ratio_limit: -1 }));
    } else if (mode === "custom") {
      // If current value is less than 0, set to 0
      setLimits(prev => ({ ...prev, ratio_limit: prev.ratio_limit < 0 ? 0 : prev.ratio_limit }));
    }
  };

  const handleSeedingTimeLimitModeChange = (mode: "global" | "unlimited" | "custom") => {
    setSeedingTimeLimitMode(mode);
    if (mode === "global") {
      setLimits(prev => ({ ...prev, seeding_time_limit: -2 }));
    } else if (mode === "unlimited") {
      setLimits(prev => ({ ...prev, seeding_time_limit: -1 }));
    }
    // For custom, keep current value or set to 0
  };

  const handleInactiveSeedingTimeLimitModeChange = (mode: "global" | "unlimited" | "custom") => {
    setInactiveSeedingTimeLimitMode(mode);
    if (mode === "global") {
      setLimits(prev => ({ ...prev, inactive_seeding_time_limit: -2 }));
    } else if (mode === "unlimited") {
      setLimits(prev => ({ ...prev, inactive_seeding_time_limit: -1 }));
    }
    // For custom, keep current value or set to 0
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-card border rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Share2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Torrent Limits</h2>
              {taskName && (
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                  {taskName}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
            disabled={isSaving}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">Loading limits...</p>
            </div>
          ) : (
            <>
              {/* Speed Limits Section */}
              {(taskStatus === null || isDownloadStatus(taskStatus) || isUploadStatus(taskStatus)) && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Speed Limits</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Auto</span>
                      <Switch
                        checked={!isAutoMode}
                        onCheckedChange={(checked) => setIsAutoMode(!checked)}
                      />
                    </div>
                  </div>

                  {/* Download Limit - Only show if task status is in DOWNLOAD_STATUSES */}
                  {(taskStatus === null || isDownloadStatus(taskStatus)) && (
                    <div className="space-y-3">
                      <Label htmlFor="download_limit" className="flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        <span>Download Limit</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground"></span>
                        {limits.download_limit === 0 ? (
                          <span className="text-sm font-bold text-primary flex items-center gap-1">
                            Unlimited
                            <InfinityIcon className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-primary">
                            {formatBytes(limits.download_limit)}/s
                          </span>
                        )}
                      </Label>
                      <div className="space-y-2">
                        <Slider
                          value={[bytesToSliderIndex(limits.download_limit)]}
                          onValueChange={(value) => {
                            const bytes = sliderIndexToBytes(value[0]);
                            handleInputChange("download_limit", bytes.toString());
                          }}
                          min={1}
                          max={SPEED_LIMIT_SEGMENTS.length + 1}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                          <span>{formatBytes(SPEED_LIMIT_SEGMENTS[0])}/s</span>
                          <span>Unlimited</span>
                        </div>
                      </div>
                      {isAutoMode && (
                        <div className="flex items-center gap-2">
                          <Input
                            id="download_limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limits.download_limit === 0 ? "" : limits.download_limit}
                            onChange={(e) => handleInputChange("download_limit", e.target.value)}
                            placeholder="0 = unlimited"
                            className="flex-1"
                          />
                          {limits.download_limit > 0 && (
                            <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] text-right">
                              ({formatBytes(limits.download_limit)}/s)
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Move slider to maximum for unlimited download speed
                      </p>
                    </div>
                  )}

                  {/* Upload Limit - Only show if task status is in UPLOAD_STATUSES */}
                  {(taskStatus === null || isUploadStatus(taskStatus)) && (
                    <div className="space-y-3">
                      <Label htmlFor="upload_limit" className="flex items-center gap-2">
                        <Upload className="h-4 w-4" />
                        <span>Upload Limit</span>
                        <span className="h-1 w-1 rounded-full bg-muted-foreground"></span>
                        {limits.upload_limit === 0 ? (
                          <span className="text-sm font-bold text-primary flex items-center gap-1">
                            Unlimited
                            <InfinityIcon className="h-4 w-4" />
                          </span>
                        ) : (
                          <span className="text-sm font-bold text-primary">
                            {formatBytes(limits.upload_limit)}/s
                          </span>
                        )}
                      </Label>
                      <div className="space-y-2">
                        <Slider
                          value={[bytesToSliderIndex(limits.upload_limit)]}
                          onValueChange={(value) => {
                            const bytes = sliderIndexToBytes(value[0]);
                            handleInputChange("upload_limit", bytes.toString());
                          }}
                          min={1}
                          max={SPEED_LIMIT_SEGMENTS.length + 1}
                          step={1}
                          className="w-full"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground px-1">
                          <span>{formatBytes(SPEED_LIMIT_SEGMENTS[0])}/s</span>
                          <span>Unlimited</span>
                        </div>
                      </div>
                      {isAutoMode && (
                        <div className="flex items-center gap-2">
                          <Input
                            id="upload_limit"
                            type="number"
                            min="0"
                            step="1"
                            value={limits.upload_limit === 0 ? "" : limits.upload_limit}
                            onChange={(e) => handleInputChange("upload_limit", e.target.value)}
                            placeholder="0 = unlimited"
                            className="flex-1"
                          />
                          {limits.upload_limit > 0 && (
                            <span className="text-sm text-muted-foreground whitespace-nowrap min-w-[100px] text-right">
                              ({formatBytes(limits.upload_limit)}/s)
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Move slider to maximum for unlimited upload speed
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Share Limits Section */}
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">Share Limits</h3>

                {/* Ratio Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ratio_limit" className="flex items-center gap-2">
                      <Share2 className="h-4 w-4" />
                      Ratio Limit
                    </Label>
                    <ButtonGroup orientation="horizontal">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={ratioLimitMode === "unlimited" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleRatioLimitModeChange("unlimited")}
                          >
                            <InfinityIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Unlimited</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={ratioLimitMode === "global" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleRatioLimitModeChange("global")}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Global Limit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={ratioLimitMode === "custom" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleRatioLimitModeChange("custom")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Custom</p>
                        </TooltipContent>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                  {ratioLimitMode === "custom" && (
                  <div className="flex items-center gap-2">
                    <Input
                      id="ratio_limit"
                      type="number"
                        min="0"
                      step="0.1"
                        value={limits.ratio_limit >= 0 ? limits.ratio_limit : ""}
                      onChange={(e) => handleInputChange("ratio_limit", e.target.value)}
                        placeholder="Ratio value"
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {limits.ratio_limit >= 0 ? `Ratio: ${limits.ratio_limit.toFixed(1)}` : "Ratio:"}
                    </span>
                  </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {ratioLimitMode === "global"
                      ? "Use global limit"
                      : ratioLimitMode === "unlimited"
                      ? "No limit"
                      : "Set a custom ratio value (>= 0)"}
                  </p>
                </div>

                {/* Seeding Time Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="seeding_time_limit" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Seeding Time Limit (minutes)
                    </Label>
                    <ButtonGroup orientation="horizontal">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={seedingTimeLimitMode === "unlimited" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleSeedingTimeLimitModeChange("unlimited")}
                          >
                            <InfinityIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Unlimited</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={seedingTimeLimitMode === "global" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleSeedingTimeLimitModeChange("global")}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Global Limit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={seedingTimeLimitMode === "custom" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleSeedingTimeLimitModeChange("custom")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Custom</p>
                        </TooltipContent>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                  {seedingTimeLimitMode === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        id="seeding_time_limit"
                        type="number"
                        min="0"
                        step="1"
                        value={limits.seeding_time_limit >= 0 ? limits.seeding_time_limit : ""}
                        onChange={(e) => handleInputChange("seeding_time_limit", e.target.value)}
                        placeholder="Minutes"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatMinutes(limits.seeding_time_limit >= 0 ? limits.seeding_time_limit : 0)}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {seedingTimeLimitMode === "global"
                      ? "Use global limit"
                      : seedingTimeLimitMode === "unlimited"
                      ? "No limit"
                      : "Set a custom seeding time limit in minutes (>= 0)"}
                  </p>
                </div>

                {/* Inactive Seeding Time Limit */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="inactive_seeding_time_limit" className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Inactive Seeding Time Limit (minutes)
                    </Label>
                    <ButtonGroup orientation="horizontal">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={inactiveSeedingTimeLimitMode === "unlimited" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleInactiveSeedingTimeLimitModeChange("unlimited")}
                          >
                            <InfinityIcon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Unlimited</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={inactiveSeedingTimeLimitMode === "global" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleInactiveSeedingTimeLimitModeChange("global")}
                          >
                            <Globe className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Global Limit</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={inactiveSeedingTimeLimitMode === "custom" ? "default" : "outline"}
                            size="icon"
                            onClick={() => handleInactiveSeedingTimeLimitModeChange("custom")}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Custom</p>
                        </TooltipContent>
                      </Tooltip>
                    </ButtonGroup>
                  </div>
                  {inactiveSeedingTimeLimitMode === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input
                        id="inactive_seeding_time_limit"
                        type="number"
                        min="0"
                        step="1"
                        value={limits.inactive_seeding_time_limit >= 0 ? limits.inactive_seeding_time_limit : ""}
                        onChange={(e) => handleInputChange("inactive_seeding_time_limit", e.target.value)}
                        placeholder="Minutes"
                        className="flex-1"
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatMinutes(limits.inactive_seeding_time_limit >= 0 ? limits.inactive_seeding_time_limit : 0)}
                      </span>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {inactiveSeedingTimeLimitMode === "global"
                      ? "Use global limit"
                      : inactiveSeedingTimeLimitMode === "unlimited"
                      ? "No limit"
                      : "Set a custom inactive seeding time limit in minutes (>= 0)"}
                  </p>
                </div>

              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

