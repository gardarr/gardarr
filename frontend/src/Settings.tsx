// Settings.tsx
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Globe, Save, RotateCcw, Languages, Settings as SettingsIcon, HardDrive, Trash2, AlertTriangle, ImageIcon, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { settingsService, type TimezoneInfo, type ImageStorageStatsResponse } from "@/services/settings";
import { formatBytes } from "@/utils/bytes";
import { toast } from "sonner";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Moscow",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
  "UTC",
];

const LANGUAGES = [
  { value: "en-US", label: "settings.language.languages.en-US" },
  { value: "pt-BR", label: "settings.language.languages.pt-BR" },
];

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [timezone, setTimezone] = useState<string>("");
  const [savedTimezone, setSavedTimezone] = useState<string>("");
  const [currentTime, setCurrentTime] = useState<string>("");
  const [language, setLanguage] = useState<string>(i18n.language);
  const [savedLanguage, setSavedLanguage] = useState<string>(i18n.language);
  const [availableTimezones, setAvailableTimezones] = useState<TimezoneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageStats, setImageStats] = useState<ImageStorageStatsResponse | null>(null);
  const [imageStatsLoading, setImageStatsLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'agent' | 'orphans'; agentId?: string; agentName?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      // Load current settings from backend
      const [timezoneResponse, languageResponse, timezonesResponse] = await Promise.all([
        settingsService.getTimezone(),
        settingsService.getLanguage(),
        settingsService.getTimezones()
      ]);

      if (timezoneResponse.data) {
        const tz = timezoneResponse.data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(tz);
        setSavedTimezone(tz);
      }

      if (languageResponse.data) {
        const lang = languageResponse.data.default_language || i18n.language;
        setLanguage(lang);
        setSavedLanguage(lang);
        // Sync with i18n if different from current
        if (lang !== i18n.language) {
          i18n.changeLanguage(lang);
          localStorage.setItem("app_language", lang);
        }
      }

      if (timezonesResponse.data) {
        setAvailableTimezones(timezonesResponse.data.timezones);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error(t('settings.loadError'));
      
      // Fallback to system detection
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setTimezone(detectedTimezone);
      setSavedTimezone(detectedTimezone);
      // Convert TIMEZONES array to TimezoneInfo format
      setAvailableTimezones(TIMEZONES.map(tz => ({ value: tz, label: tz })));
      
      // Use current i18n language as fallback
      setLanguage(i18n.language);
      setSavedLanguage(i18n.language);
    } finally {
      setLoading(false);
    }
  }, [t, i18n]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    // Update current time every second
    const interval = setInterval(() => {
      if (timezone) {
        try {
          const now = new Date();
          const formatter = new Intl.DateTimeFormat(i18n.language, {
            timeZone: timezone,
            dateStyle: "full",
            timeStyle: "long",
          });
          setCurrentTime(formatter.format(now));
        } catch {
          setCurrentTime("Invalid timezone");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timezone, i18n.language]);


  const handleSaveTimezone = async () => {
    setSaving(true);
    try {
      const result = await settingsService.updateTimezone(timezone);
      if (result.error) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
      
      setSavedTimezone(timezone);
      toast.success(t("settings.timezone.saveSuccess") + `: ${timezone}`);
    } catch (error) {
      console.error('Failed to save timezone:', error);
      toast.error('Failed to save timezone');
    } finally {
      setSaving(false);
    }
  };

  const handleResetTimezone = () => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
  };

  const handleSaveLanguage = async () => {
    setSaving(true);
    try {
      const result = await settingsService.updateLanguage(language);
      if (result.error) {
        toast.error(result.error);
        setSaving(false);
        return;
      }
      
      i18n.changeLanguage(language);
      localStorage.setItem("app_language", language);
      setSavedLanguage(language);
      toast.success(t("settings.language.saveSuccess"));
    } catch (error) {
      console.error('Failed to save language:', error);
      toast.error('Failed to save language');
    } finally {
      setSaving(false);
    }
  };

  const hasTimezoneChanges = timezone !== savedTimezone;
  const hasLanguageChanges = language !== savedLanguage;

  const loadImageStats = useCallback(async () => {
    setImageStatsLoading(true);
    try {
      const response = await settingsService.getImageStorageStats();
      if (response.data) {
        setImageStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load image storage stats:', error);
    } finally {
      setImageStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadImageStats();
  }, [loadImageStats]);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'agent' && deleteTarget.agentId) {
        const result = await settingsService.deleteAgentImages(deleteTarget.agentId);
        if (result.error) {
          toast.error(t('settings.imageStorage.deleteError', { message: result.error }));
          return;
        }
        toast.success(t('settings.imageStorage.imagesDeleted', { count: result.data?.deleted_count ?? 0 }));
      } else if (deleteTarget.type === 'orphans') {
        const result = await settingsService.deleteOrphanImages();
        if (result.error) {
          toast.error(t('settings.imageStorage.deleteError', { message: result.error }));
          return;
        }
        toast.success(t('settings.imageStorage.orphansDeleted', { count: result.data?.deleted_count ?? 0 }));
      }
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      loadImageStats();
    } catch (error) {
      console.error('Failed to delete images:', error);
      toast.error(t('settings.imageStorage.deleteFailedGeneric'));
    } finally {
      setDeleting(false);
    }
  };

  const openDeleteDialog = (type: 'agent' | 'orphans', agentId?: string, agentName?: string) => {
    setDeleteTarget({ type, agentId, agentName });
    setDeleteDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">{t("settings.loading")}</p>
        </div>
      </div>
    );
  }

  const renderImageStorageContent = () => {
    if (imageStatsLoading && !imageStats) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (imageStats) {
      return (
        <>
          {/* Summary */}
          <div className="p-4 bg-secondary rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">
                  {t("settings.imageStorage.totalImages")}: {imageStats.total_image_count}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("settings.imageStorage.diskUsage")}: {formatBytes(imageStats.total_size_bytes)}
                </p>
              </div>
            </div>
          </div>

          {/* Per-agent table */}
          {imageStats.agents && imageStats.agents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("settings.imageStorage.byAgent")}
              </h4>
              <div className="border rounded-lg divide-y">
                {imageStats.agents.map((agent) => (
                  <div key={agent.agent_id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {agent.is_removed && (
                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {agent.agent_name || t("settings.imageStorage.unknownAgent")}
                          {agent.is_removed && (
                            <span className="ml-2 text-xs text-amber-500 font-normal">
                              ({t("settings.imageStorage.removed")})
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {agent.image_count} {t("settings.imageStorage.images")} · {formatBytes(agent.total_size_bytes)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => openDeleteDialog('agent', agent.agent_id, agent.agent_name)}
                      disabled={deleting}
                      className="flex-shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                      {t("settings.imageStorage.delete")}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Orphan files */}
          {imageStats.orphan_count > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t("settings.imageStorage.orphanFiles")}
              </h4>
              <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-sm font-medium">
                      {imageStats.orphan_count} {t("settings.imageStorage.orphanFilesFound")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(imageStats.orphan_size_bytes)} · {t("settings.imageStorage.orphanHint")}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDeleteDialog('orphans')}
                  disabled={deleting}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  {t("settings.imageStorage.cleanUp")}
                </Button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {imageStats.total_image_count === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("settings.imageStorage.noImages")}
            </p>
          )}
        </>
      );
    }

    return (
      <p className="text-sm text-muted-foreground">
        {t("settings.imageStorage.loadError")}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("settings.title")}</h1>
            <p className="text-muted-foreground">
              {t("settings.subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Language Settings Card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.language.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("settings.language.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Language Selector */}
          <div className="space-y-2">
            <label 
              htmlFor="language-select" 
              className="text-sm font-medium"
            >
              {t("settings.language.selectLabel")}
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm"
            >
              <option value="">{t("settings.language.selectPlaceholder")}</option>
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {t(lang.label)}
                </option>
              ))}
            </select>
          </div>

          {/* Current Language Info */}
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>{t("settings.language.current")}:</strong>{" "}
              {t(`settings.language.languages.${savedLanguage}`)}
            </p>
          </div>

          {/* Action Button */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={handleSaveLanguage}
              disabled={!hasLanguageChanges || !language || loading || saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? t("settings.saving") : t("settings.language.saveChanges")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Settings Card */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle>{t("settings.timezone.title")}</CardTitle>
          </div>
          <CardDescription>
            {t("settings.timezone.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Time Display */}
          {currentTime && (
            <div className="p-4 bg-secondary rounded-lg">
              <p className="text-sm font-medium text-muted-foreground mb-1">
                {t("settings.timezone.currentTime")}
              </p>
              <p className="text-lg font-semibold">
                {currentTime}
              </p>
            </div>
          )}

          {/* Timezone Selector */}
          <div className="space-y-2">
            <label 
              htmlFor="timezone-select" 
              className="text-sm font-medium"
            >
              {t("settings.timezone.selectLabel")}
            </label>
            <select
              id="timezone-select"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 text-sm"
            >
              <option value="">{t("settings.timezone.selectPlaceholder")}</option>
              {availableTimezones.length > 0 ? availableTimezones.map((tz, index) => (
                <option key={`timezone-${tz.value}-${index}`} value={tz.value}>
                  {tz.value}
                </option>
              )) : TIMEZONES.map((tz, index) => (
                <option key={`timezone-${tz}-${index}`} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {/* Detected Timezone Info */}
          <div className="text-sm text-muted-foreground">
            <p>
              <strong>{t("settings.timezone.detected")}:</strong>{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
            {savedTimezone && (
              <p className="mt-1">
                <strong>{t("settings.timezone.saved")}:</strong> {savedTimezone}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              onClick={handleSaveTimezone}
              disabled={!hasTimezoneChanges || !timezone || loading || saving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? t("settings.saving") : t("settings.timezone.saveChanges")}
            </Button>
            <Button
              variant="outline"
              onClick={handleResetTimezone}
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              {t("settings.timezone.resetToDetected")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Image Storage Management */}
      <Card className="max-w-3xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle>{t("settings.imageStorage.title")}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadImageStats}
              disabled={imageStatsLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${imageStatsLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <CardDescription>
            {t("settings.imageStorage.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderImageStorageContent()}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { if (!deleting) setDeleteDialogOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.type === 'orphans'
                ? t("settings.imageStorage.confirmDeleteOrphans.title")
                : t("settings.imageStorage.confirmDeleteAgent.title")}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'orphans'
                ? t("settings.imageStorage.confirmDeleteOrphans.description")
                : t("settings.imageStorage.confirmDeleteAgent.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              {t("settings.imageStorage.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
              {deleting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {t("settings.imageStorage.confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
