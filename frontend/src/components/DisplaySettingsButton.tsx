import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LayoutGrid, LayoutList, Table2, Rows3, Minimize2, Check, Droplets } from "lucide-react";
import { api } from "@/lib/api";
import { preferencesService, type UserPreferences } from "@/services/preferences";
import { toast } from "sonner";

const DISPLAY_MODES = [
  { value: "table", label: "profile.display.modes.table", icon: Table2 },
  { value: "card", label: "profile.display.modes.card", icon: LayoutGrid },
  { value: "card_b", label: "profile.display.modes.cardCompact", icon: Rows3 },
  { value: "list", label: "profile.display.modes.list", icon: LayoutList },
] as const;

export default function DisplaySettingsButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<UserPreferences["torrent_display_mode"]>("card");
  const [compact, setCompact] = useState(false);
  const [blurIntensity, setBlurIntensity] = useState(50);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = preferencesService.load();
    if (cached) {
      setDisplayMode(cached.torrent_display_mode);
      setCompact(cached.compact);
      setBlurIntensity(cached.background_image_blur_intensity);
    }

    const handlePreferencesUpdated = () => {
      const prefs = preferencesService.load();
      if (prefs) {
        setDisplayMode(prefs.torrent_display_mode);
        setCompact(prefs.compact);
        setBlurIntensity(prefs.background_image_blur_intensity);
      }
    };

    window.addEventListener("storage", handlePreferencesUpdated);
    window.addEventListener("preferencesUpdated", handlePreferencesUpdated);
    return () => {
      window.removeEventListener("storage", handlePreferencesUpdated);
      window.removeEventListener("preferencesUpdated", handlePreferencesUpdated);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const updatePreference = useCallback(async (key: string, value: unknown) => {
    setIsLoading(true);
    try {
      const response = await api.put<UserPreferences>("/profile/preferences", { [key]: value });
      if (response.data) {
        setDisplayMode(response.data.torrent_display_mode);
        setCompact(response.data.compact);
        setBlurIntensity(response.data.background_image_blur_intensity);
        preferencesService.save(response.data);
        window.dispatchEvent(new Event("preferencesUpdated"));
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      toast.error(t("profile.display.preferencesError"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  return (
    <TooltipProvider>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("profile.display.title")}
          onClick={() => setOpen(!open)}
          className={`h-8 w-8 flex items-center justify-center ${
            open ? "bg-primary/10 text-primary hover:bg-primary/20" : ""
          }`}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>

        {open && (
          <div className="absolute z-50 right-0 mt-2 w-72 bg-card border border-border rounded-md shadow-lg p-3">
            <div className="space-y-3">
              {/* Torrent Display Mode */}
              <div className="space-y-2">
                <h4 className="text-xs text-foreground/80">{t("profile.display.torrentDisplayMode")}</h4>
                <div className="grid grid-cols-4 gap-1.5">
                  {DISPLAY_MODES.map(({ value, label, icon: Icon }) => (
                    <Tooltip key={value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => updatePreference("torrent_display_mode", value)}
                          disabled={isLoading}
                          className={`relative flex items-center justify-center h-9 rounded-md border-2 transition-all hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                            displayMode === value ? "border-primary bg-primary/5" : "border-border/50"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {displayMode === value && (
                            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                              <Check className="h-2.5 w-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t(label)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Compact Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Minimize2 className="h-4 w-4 text-foreground/50" />
                  <span className="text-xs text-foreground/80">{t("profile.display.compactMode")}</span>
                </div>
                <button
                  type="button"
                  onClick={() => updatePreference("compact", !compact)}
                  disabled={isLoading}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                    compact ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      compact ? "translate-x-[18px]" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <Separator />

              {/* Background Image Blur */}
              <div className="space-y-2">
                <h4 className="text-xs text-foreground/80 flex items-center gap-1.5">
                  <Droplets className="h-4 w-4 text-foreground/50" />
                  {t("profile.display.blurIntensity")}
                </h4>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={blurIntensity}
                    onChange={(e) => setBlurIntensity(Number.parseInt(e.target.value, 10))}
                    onMouseUp={(e) => updatePreference("background_image_blur_intensity", Number.parseInt((e.target as HTMLInputElement).value, 10))}
                    onTouchEnd={(e) => updatePreference("background_image_blur_intensity", Number.parseInt((e.target as HTMLInputElement).value, 10))}
                    disabled={isLoading}
                    className="flex-1 h-1.5 bg-muted rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                  />
                  <span className="text-xs text-muted-foreground min-w-[2.5ch]">{blurIntensity}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
