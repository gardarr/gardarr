import { useState, useEffect, useCallback } from "react";
import { X, Share2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { torrentService } from "@/services/torrents";
import type { TaskLimits } from "@/types/torrent";
import { normalizeTaskStatus } from "@/utils/statusUtils";
import type { TaskStatus } from "@/utils/statusUtils";
import { toast } from "sonner";
import { SpeedLimitControl } from "@/components/SpeedLimitControl";
import { ShareLimitControl } from "@/components/ShareLimitControl";
import type { LimitMode } from "@/utils/limitUtils";
import { syncLimitModes, getLimitValue } from "@/utils/limitUtils";

interface TorrentLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  taskId: string;
  taskName?: string;
  taskStatus?: string;
  selectedCount?: number;
}

export function TorrentLimitModal({
  isOpen,
  onClose,
  agentId,
  taskId,
  taskName,
  taskStatus: taskStatusProp,
  selectedCount = 1
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
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [ratioLimitMode, setRatioLimitMode] = useState<LimitMode>("custom");
  const [seedingTimeLimitMode, setSeedingTimeLimitMode] = useState<LimitMode>("custom");
  const [inactiveSeedingTimeLimitMode, setInactiveSeedingTimeLimitMode] = useState<LimitMode>("custom");
  
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
        const modes = syncLimitModes(response.data);
        setRatioLimitMode(modes.ratioMode);
        setSeedingTimeLimitMode(modes.seedingTimeMode);
        setInactiveSeedingTimeLimitMode(modes.inactiveSeedingTimeMode);
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

  const saveDownloadLimit = async (): Promise<boolean> => {
    if (limits.download_limit > 0) {
      const response = await torrentService.setTaskDownloadLimit(agentId, taskId, limits.download_limit);
      if (response.error) {
        setError(response.error);
        return false;
      }
    }
    return true;
  };

  const saveUploadLimit = async (): Promise<boolean> => {
    if (limits.upload_limit > 0) {
      const response = await torrentService.setTaskUploadLimit(agentId, taskId, limits.upload_limit);
      if (response.error) {
        setError(response.error);
        return false;
      }
    }
    return true;
  };

  const saveShareLimits = async (): Promise<boolean> => {
    const response = await torrentService.setTaskShareLimit(
      agentId,
      taskId,
      limits.ratio_limit,
      limits.seeding_time_limit,
      limits.inactive_seeding_time_limit
    );
    if (response.error) {
      setError(response.error);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!agentId || !taskId) return;

    setIsSaving(true);
    setError(null);

    try {
      if (!(await saveDownloadLimit())) {
        return;
      }
      if (!(await saveUploadLimit())) {
        return;
      }
      if (!(await saveShareLimits())) {
        return;
      }

      const successMessage = selectedCount > 1 
        ? `Limits updated for ${selectedCount} torrents`
        : "Torrent limits updated successfully";
      toast.success(successMessage);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save limits");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof TaskLimits, value: string) => {
    const numValue = value === "" ? 0 : Number.parseFloat(value);
    const newValue = Number.isNaN(numValue) ? limits[field] : numValue;
    
    setLimits(prev => ({
      ...prev,
      [field]: newValue
    }));
  };

  const handleLimitModeChange = (
    mode: LimitMode,
    field: "ratio_limit" | "seeding_time_limit" | "inactive_seeding_time_limit",
    setMode: (mode: LimitMode) => void
  ) => {
    setMode(mode);
    const value = getLimitValue(mode, limits[field]);
    setLimits(prev => ({ ...prev, [field]: value }));
  };

  const handleRatioLimitModeChange = (mode: LimitMode) => {
    handleLimitModeChange(mode, "ratio_limit", setRatioLimitMode);
  };

  const handleSeedingTimeLimitModeChange = (mode: LimitMode) => {
    handleLimitModeChange(mode, "seeding_time_limit", setSeedingTimeLimitMode);
  };

  const handleInactiveSeedingTimeLimitModeChange = (mode: LimitMode) => {
    handleLimitModeChange(mode, "inactive_seeding_time_limit", setInactiveSeedingTimeLimitMode);
  };

  const handleBackdropKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        onKeyDown={handleBackdropKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
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
              <h2 className="text-2xl font-bold">
                {selectedCount > 1 ? `Torrent Limits (${selectedCount} selected)` : "Torrent Limits"}
              </h2>
              {taskName && selectedCount === 1 && (
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                  {taskName}
                </p>
              )}
              {selectedCount > 1 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Changes will be applied to all selected torrents
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
              <SpeedLimitControl
                limits={limits}
                isAdvancedMode={isAdvancedMode}
                taskStatus={taskStatus}
                onLimitChange={handleInputChange}
                onAdvancedModeChange={setIsAdvancedMode}
              />

              <ShareLimitControl
                limits={limits}
                ratioLimitMode={ratioLimitMode}
                seedingTimeLimitMode={seedingTimeLimitMode}
                inactiveSeedingTimeLimitMode={inactiveSeedingTimeLimitMode}
                onLimitChange={handleInputChange}
                onRatioLimitModeChange={handleRatioLimitModeChange}
                onSeedingTimeLimitModeChange={handleSeedingTimeLimitModeChange}
                onInactiveSeedingTimeLimitModeChange={handleInactiveSeedingTimeLimitModeChange}
              />

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

