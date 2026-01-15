import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Palette, Check, SwatchBook, Paintbrush, Sparkles } from "lucide-react";
import { preferencesService } from "@/services/preferences";

const COLOR_VARIANTS = [
  { value: "default", label: "settings.colorVariant.variants.default", color: "oklch(0.623 0.214 259.815)" },
  { value: "aura", label: "settings.colorVariant.variants.aura", color: "oklch(0.58 0.28 280)" },
  { value: "sunset", label: "settings.colorVariant.variants.sunset", color: "oklch(0.65 0.24 35)" },
  { value: "ocean", label: "settings.colorVariant.variants.ocean", color: "oklch(0.55 0.22 220)" },
  { value: "forest", label: "settings.colorVariant.variants.forest", color: "oklch(0.52 0.20 145)" },
  { value: "lavender", label: "settings.colorVariant.variants.lavender", color: "oklch(0.65 0.20 300)" },
  { value: "rose", label: "settings.colorVariant.variants.rose", color: "oklch(0.62 0.26 350)" },
  { value: "amber", label: "settings.colorVariant.variants.amber", color: "oklch(0.68 0.22 65)" },
  { value: "mint", label: "settings.colorVariant.variants.mint", color: "oklch(0.58 0.20 170)" },
  { value: "crimson", label: "settings.colorVariant.variants.crimson", color: "oklch(0.52 0.24 15)" },
  { value: "cyberpunk", label: "settings.colorVariant.variants.cyberpunk", color: "oklch(0.60 0.24 195)" },
  { value: "golden", label: "settings.colorVariant.variants.golden", color: "oklch(0.75 0.18 90)" },
  { value: "earth", label: "settings.colorVariant.variants.earth", color: "oklch(0.48 0.12 50)" },
  { value: "silver", label: "settings.colorVariant.variants.silver", color: "oklch(0.60 0.02 260)" },
];

export default function VariantColorSelectButton() {
  const { t } = useTranslation();
  const [colorVariant, setColorVariant] = useState<string>("default");
  const [colorVariantDropdownOpen, setColorVariantDropdownOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const colorVariantDropdownRef = useRef<HTMLDivElement>(null);
  
  // Custom palettes state
  const [customPalettes, setCustomPalettes] = useState<{
    palette1: { primary: string; secondary: string; accent: string; muted: string };
    palette2: { primary: string; secondary: string; accent: string; muted: string };
    palette3: { primary: string; secondary: string; accent: string; muted: string };
  }>({
    palette1: { primary: "#3b82f6", secondary: "#8b5cf6", accent: "#10b981", muted: "#6b7280" },
    palette2: { primary: "#ef4444", secondary: "#f59e0b", accent: "#ec4899", muted: "#78716c" },
    palette3: { primary: "#06b6d4", secondary: "#14b8a6", accent: "#a855f7", muted: "#64748b" },
  });

  useEffect(() => {
    // Load saved color variant from localStorage
    const storedVariant = localStorage.getItem("app_color_variant") || "default";
    setColorVariant(storedVariant);
    
    // Load custom palettes from preferences
    const prefs = preferencesService.load();
    if (prefs) {
      setCustomPalettes({
        palette1: {
          primary: prefs.color_palette_1_primary,
          secondary: prefs.color_palette_1_secondary,
          accent: prefs.color_palette_1_accent,
          muted: prefs.color_palette_1_muted,
        },
        palette2: {
          primary: prefs.color_palette_2_primary,
          secondary: prefs.color_palette_2_secondary,
          accent: prefs.color_palette_2_accent,
          muted: prefs.color_palette_2_muted,
        },
        palette3: {
          primary: prefs.color_palette_3_primary,
          secondary: prefs.color_palette_3_secondary,
          accent: prefs.color_palette_3_accent,
          muted: prefs.color_palette_3_muted,
        },
      });
      
      // Apply custom palette if it's the active variant
      if (storedVariant.startsWith("custom-")) {
        applyCustomPalette(storedVariant, prefs);
      }
    }
    
    document.documentElement.setAttribute("data-color-variant", storedVariant);
    
    // Check if dark theme is active
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Apply color variant in real-time
  useEffect(() => {
    // For custom palettes, we need to apply the CSS variables first
    if (colorVariant.startsWith("custom-")) {
      applyCustomPalette(colorVariant);
    } else {
      document.documentElement.setAttribute("data-color-variant", colorVariant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorVariant]);

  // Listen for theme changes
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          setIsDark(document.documentElement.classList.contains('dark'));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  
  // Listen for preference changes to update custom palettes
  useEffect(() => {
    const handleStorageChange = () => {
      const prefs = preferencesService.load();
      if (prefs) {
        setCustomPalettes({
          palette1: {
            primary: prefs.color_palette_1_primary,
            secondary: prefs.color_palette_1_secondary,
            accent: prefs.color_palette_1_accent,
            muted: prefs.color_palette_1_muted,
          },
          palette2: {
            primary: prefs.color_palette_2_primary,
            secondary: prefs.color_palette_2_secondary,
            accent: prefs.color_palette_2_accent,
            muted: prefs.color_palette_2_muted,
          },
          palette3: {
            primary: prefs.color_palette_3_primary,
            secondary: prefs.color_palette_3_secondary,
            accent: prefs.color_palette_3_accent,
            muted: prefs.color_palette_3_muted,
          },
        });
        
        // Re-apply custom palette if it's active
        const currentVariant = localStorage.getItem("app_color_variant") || "default";
        if (currentVariant.startsWith("custom-")) {
          applyCustomPalette(currentVariant, prefs);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen to custom event for same-tab updates
    window.addEventListener('preferencesUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('preferencesUpdated', handleStorageChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close color variant dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (colorVariantDropdownRef.current && !colorVariantDropdownRef.current.contains(event.target as Node)) {
        setColorVariantDropdownOpen(false);
      }
    };

    if (colorVariantDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [colorVariantDropdownOpen]);

  const applyCustomPalette = (variantValue: string, prefs?: ReturnType<typeof preferencesService.load>) => {
    const preferences = prefs || preferencesService.load();
    if (!preferences) return;
    
    const paletteNumber = variantValue.replace("custom-", "");
    let primary, secondary, accent, muted;
    
    if (paletteNumber === "1") {
      primary = preferences.color_palette_1_primary;
      secondary = preferences.color_palette_1_secondary;
      accent = preferences.color_palette_1_accent;
      muted = preferences.color_palette_1_muted;
    } else if (paletteNumber === "2") {
      primary = preferences.color_palette_2_primary;
      secondary = preferences.color_palette_2_secondary;
      accent = preferences.color_palette_2_accent;
      muted = preferences.color_palette_2_muted;
    } else {
      primary = preferences.color_palette_3_primary;
      secondary = preferences.color_palette_3_secondary;
      accent = preferences.color_palette_3_accent;
      muted = preferences.color_palette_3_muted;
    }
    
    // Apply custom colors as CSS variables
    const root = document.documentElement;
    root.style.setProperty('--custom-primary', primary);
    root.style.setProperty('--custom-secondary', secondary);
    root.style.setProperty('--custom-accent', accent);
    root.style.setProperty('--custom-muted', muted);
    
    // Set variant to custom which uses these variables
    root.setAttribute("data-color-variant", "custom");
  };

  const handleColorVariantChange = (variantValue: string) => {
    setColorVariant(variantValue);
    localStorage.setItem("app_color_variant", variantValue);
    
    // If it's a custom palette, apply the custom colors
    if (variantValue.startsWith("custom-")) {
      applyCustomPalette(variantValue);
    } else {
      document.documentElement.setAttribute("data-color-variant", variantValue);
    }
    // Keep dropdown open - only close on outside click
  };

  const currentVariant = COLOR_VARIANTS.find(v => v.value === colorVariant);
  
  // Get the display color for the current variant (white for default in dark mode)
  const getDisplayColor = (variant: typeof COLOR_VARIANTS[0]) => {
    if (variant.value === "default" && isDark) {
      return "#FFFFFF";
    }
    return variant.color;
  };

  return (
    <TooltipProvider>
      <div className="relative" ref={colorVariantDropdownRef}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("settings.colorVariant.title")}
                onClick={() => setColorVariantDropdownOpen(!colorVariantDropdownOpen)}
                className={`h-8 w-8 flex items-center justify-center ${
                  colorVariantDropdownOpen 
                    ? 'bg-primary/10 text-primary hover:bg-primary/20' 
                    : ''
                }`}
              >
          <Palette 
            className="h-4 w-4" 
            style={{ color: currentVariant ? getDisplayColor(currentVariant) : undefined }}
          />
        </Button>
        
        {colorVariantDropdownOpen && (
          <div className="absolute z-50 right-0 mt-2 w-64 bg-card border border-border rounded-md shadow-lg p-3">
            <div className="space-y-3">
              {/* Color Variants Section */}
              <div className="space-y-2">
                <h4 className="text-xs text-foreground/80 flex items-center gap-1.5">
                  <Paintbrush className={`h-4 w-4 ${isDark ? 'text-foreground/30' : 'text-foreground/50'}`} />
                  {t("settings.colorVariant.variants.title")}
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_VARIANTS.map((variant) => (
                    <Tooltip key={variant.value}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleColorVariantChange(variant.value)}
                                className="relative w-6 h-6 sm:w-4 sm:h-4 rounded-full border-2 border-border/50 hover:border-border transition-all duration-200 hover:scale-110"
                          style={{ backgroundColor: getDisplayColor(variant) }}
                        >
                          {colorVariant === variant.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Check className="h-3.5 w-3.5 sm:h-2.5 sm:w-2.5 text-white drop-shadow-sm" />
                            </div>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t(variant.label)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
              
              {/* Separator */}
              <Separator />
              
              {/* Custom Palettes Section */}
              <div className="space-y-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <h4 className="text-xs text-foreground/80 flex items-center gap-1.5 cursor-help">
                      <Sparkles className={`h-4 w-4 ${isDark ? 'text-foreground/30' : 'text-foreground/50'}`} />
                      {t("settings.colorVariant.custom.title")}
                    </h4>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="text-xs">{t("settings.colorVariant.custom.hint")}</p>
                  </TooltipContent>
                </Tooltip>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((paletteNum) => {
                    const paletteKey = `palette${paletteNum}` as keyof typeof customPalettes;
                    const palette = customPalettes[paletteKey];
                    const variantValue = `custom-${paletteNum}`;
                    const isActive = colorVariant === variantValue;
                    
                    return (
                      <Tooltip key={paletteNum}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => handleColorVariantChange(variantValue)}
                            className={`relative p-2 rounded-lg border-2 transition-all hover:scale-105 ${
                              isActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"
                            }`}
                          >
                            <div className="flex gap-0.5">
                              <div className="h-4 flex-1 rounded-sm" style={{ backgroundColor: palette.primary }} />
                              <div className="h-4 flex-1 rounded-sm" style={{ backgroundColor: palette.secondary }} />
                              <div className="h-4 flex-1 rounded-sm" style={{ backgroundColor: palette.accent }} />
                              <div className="h-4 flex-1 rounded-sm" style={{ backgroundColor: palette.muted }} />
                            </div>
                            {isActive && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                                <Check className="h-2.5 w-2.5 text-primary-foreground" />
                              </div>
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t(`settings.colorVariant.custom.palette${paletteNum}`)}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
              
              {/* Separator */}
              <Separator />
              
              {/* Color Preview Section */}
              <div className="flex items-center justify-between">
                <h4 className="text-xs text-foreground/80 flex items-center gap-1.5">
                  <SwatchBook className={`h-4 w-4 ${isDark ? 'text-foreground/30' : 'text-foreground/50'}`} />
                  {t("settings.colorVariant.palette.title")}
                </h4>
                <div className="flex items-center">
                  <div className="flex rounded-lg overflow-hidden border border-border shadow-sm">
                    <div className="w-6 h-6 bg-primary transition-colors" />
                    <div className="w-6 h-6 bg-secondary transition-colors" />
                    <div className="w-6 h-6 bg-accent transition-colors" />
                    <div className="w-6 h-6 bg-muted transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
