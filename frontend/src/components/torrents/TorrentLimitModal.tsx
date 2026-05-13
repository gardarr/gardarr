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
  workerId: string;
  taskIds: string[];
  taskName?: string;
  taskStatus?: string;
}

export function TorrentLimitModal({
  isOpen,
  onClose,
  workerId,
  taskIds,
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
  const [hasMixedValues, setHasMixedValues] = useState(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [ratioLimitMode, setRatioLimitMode] = useState<LimitMode>("custom");
  const [seedingTimeLimitMode, setSeedingTimeLimitMode] = useState<LimitMode>("custom");
  const [inactiveSeedingTimeLimitMode, setInactiveSeedingTimeLimitMode] = useState<LimitMode>("custom");
  
  const isBulkEdit = taskIds.length > 1;

  // Normalize task status from prop
  const taskStatus: TaskStatus | null = taskStatusProp ? normalizeTaskStatus(taskStatusProp) : null;

  // Load limits when modal opens
  const loadLimits = useCallback(async () => {
    if (!workerId || taskIds.length === 0) return;

    setIsLoading(true);
    setError(null);
    setHasMixedValues(false);

    try {
      // Load limits from all selected tasks
      const responses = await Promise.all(
        taskIds.map(id => torrentService.getTaskLimits(workerId, id))
      );

      // Check for errors
      const errors = responses.filter(r => r.error);
      if (errors.length > 0) {
        setError(errors[0].error || "Failed to load limits");
        return;
      }

      const allLimits = responses.map(r => r.data).filter(Boolean) as TaskLimits[];
      
      if (allLimits.length === 0) {
        setError("Failed to load limits");
        return;
      }

      // Use the first task's limits as base
      const baseLimits = allLimits[0];
      setLimits(baseLimits);

      // Check if there are mixed values across tasks
      let hasMixed = false;
      if (allLimits.length > 1) {
        const fields: (keyof TaskLimits)[] = [
          "download_limit",
          "upload_limit",
          "ratio_limit",
          "seeding_time_limit",
          "inactive_seeding_time_limit"
        ];

        for (const field of fields) {
          const values = allLimits.map(l => l[field]);
          const uniqueValues = new Set(values);
          if (uniqueValues.size > 1) {
            hasMixed = true;
            break;
          }
        }
      }

      setHasMixedValues(hasMixed);

      const modes = syncLimitModes(baseLimits);
      setRatioLimitMode(modes.ratioMode);
      setSeedingTimeLimitMode(modes.seedingTimeMode);
      setInactiveSeedingTimeLimitMode(modes.inactiveSeedingTimeMode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load limits");
    } finally {
      setIsLoading(false);
    }
  }, [workerId, taskIds]);

  useEffect(() => {
    if (isOpen && workerId && taskIds.length > 0) {
      loadLimits();
    }
  }, [isOpen, workerId, taskIds, loadLimits]);

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
      // Apply to all selected tasks
      const responses = await Promise.all(
        taskIds.map(id => torrentService.setTaskDownloadLimit(workerId, id, limits.download_limit))
      );
      
      const errors = responses.filter(r => r.error);
      if (errors.length > 0) {
        setError(errors[0].error || "Failed to update download limit");
        return false;
      }
    }
    return true;
  };

  const saveUploadLimit = async (): Promise<boolean> => {
    if (limits.upload_limit > 0) {
      // Apply to all selected tasks
      const responses = await Promise.all(
        taskIds.map(id => torrentService.setTaskUploadLimit(workerId, id, limits.upload_limit))
      );
      
      const errors = responses.filter(r => r.error);
      if (errors.length > 0) {
        setError(errors[0].error || "Failed to update upload limit");
        return false;
      }
    }
    return true;
  };

  const saveShareLimits = async (): Promise<boolean> => {
    // Apply to all selected tasks
    const responses = await Promise.all(
      taskIds.map(id => torrentService.setTaskShareLimit(
        workerId,
        id,
        limits.ratio_limit,
        limits.seeding_time_limit,
        limits.inactive_seeding_time_limit
      ))
    );
    
    const errors = responses.filter(r => r.error);
    if (errors.length > 0) {
      setError(errors[0].error || "Failed to update share limits");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!workerId || taskIds.length === 0) return;

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

      const successMessage = isBulkEdit
        ? `Limits updated for ${taskIds.length} torrents`
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
                {isBulkEdit ? `Torrent Limits (${taskIds.length} selected)` : "Torrent Limits"}
              </h2>
              {taskName && !isBulkEdit && (
                <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                  {taskName}
                </p>
              )}
              {isBulkEdit && (
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

          {hasMixedValues && isBulkEdit && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-600 dark:text-blue-400">
                Selected torrents have different limit values. Displayed values are from the first selected torrent. 
                Saving will apply the same limits to all selected torrents.
              </p>
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

