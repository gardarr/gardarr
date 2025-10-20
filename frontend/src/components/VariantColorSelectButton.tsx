import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Palette, Check, SwatchBook, Paintbrush } from "lucide-react";

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

  useEffect(() => {
    // Load saved color variant from localStorage
    const storedVariant = localStorage.getItem("app_color_variant") || "default";
    setColorVariant(storedVariant);
    document.documentElement.setAttribute("data-color-variant", storedVariant);
    
    // Check if dark theme is active
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  // Apply color variant in real-time
  useEffect(() => {
    document.documentElement.setAttribute("data-color-variant", colorVariant);
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

  const handleColorVariantChange = (variantValue: string) => {
    setColorVariant(variantValue);
    localStorage.setItem("app_color_variant", variantValue);
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
