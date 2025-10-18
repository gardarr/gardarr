import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Monitor, Globe, Moon, Sun, LogOut, Check, ChevronsUpDown } from "lucide-react";
import { api } from "@/lib/api";

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

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

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [colorVariant, setColorVariant] = useState<string>("default");
  const [colorVariantDropdownOpen, setColorVariantDropdownOpen] = useState(false);
  const colorVariantDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
    
    // Load saved color variant from localStorage
    const storedVariant = localStorage.getItem("app_color_variant") || "default";
    setColorVariant(storedVariant);
    document.documentElement.setAttribute("data-color-variant", storedVariant);
  }, []);

  // Apply color variant in real-time
  useEffect(() => {
    document.documentElement.setAttribute("data-color-variant", colorVariant);
  }, [colorVariant]);

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

  const loadSessions = async () => {
    setIsLoading(true);
    const response = await api.get<Session[]>("/auth/sessions");
    if (response.data) {
      setSessions(response.data);
    }
    setIsLoading(false);
  };

  const handleLogoutAll = async () => {
    if (confirm(t("profile.confirmLogoutAll"))) {
      await api.post("/auth/logout-all");
      await logout();
    }
  };

  const toggleTheme = () => {
    const root = document.documentElement;
    const nextDark = !root.classList.contains('dark');
    if (nextDark) {
      root.classList.add('dark');
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove('dark');
      localStorage.setItem("theme", "light");
    }
    setIsDark(nextDark);
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    localStorage.setItem("app_language", lng);
  };

  const handleColorVariantChange = (variantValue: string) => {
    setColorVariant(variantValue);
    localStorage.setItem("app_color_variant", variantValue);
    setColorVariantDropdownOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getBrowserName = (userAgent: string) => {
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    return 'Unknown Browser';
  };

  const getDeviceType = (userAgent: string) => {
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    return 'Desktop';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t("profile.personalInfo.title")}</CardTitle>
              <CardDescription>{t("profile.personalInfo.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t("profile.personalInfo.email")}
            </label>
            <p className="text-base">{user?.email}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t("profile.personalInfo.uuid")}
            </label>
            <p className="text-sm font-mono text-muted-foreground">{user?.uuid}</p>
          </div>
          <Separator />
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              {t("profile.personalInfo.memberSince")}
            </label>
            <p className="text-base">
              {user?.created_at && formatDate(user.created_at)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>{t("profile.preferences.title")}</CardTitle>
              <CardDescription>{t("profile.preferences.description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Theme Preference */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t("profile.preferences.theme")}
              </label>
              <p className="text-sm text-muted-foreground">
                {isDark ? t("profile.preferences.dark") : t("profile.preferences.light")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={toggleTheme}>
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 mr-2" />
                  {t("profile.preferences.switchToLight")}
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 mr-2" />
                  {t("profile.preferences.switchToDark")}
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Language Preference */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t("profile.preferences.language")}
              </label>
              <p className="text-sm text-muted-foreground">
                {i18n.language === 'pt-BR' ? 'Português (Brasil)' : 'English (US)'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={i18n.language === 'en-US' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('en-US')}
              >
                English
              </Button>
              <Button
                variant={i18n.language === 'pt-BR' ? 'default' : 'outline'}
                size="sm"
                onClick={() => changeLanguage('pt-BR')}
              >
                Português
              </Button>
            </div>
          </div>

          <Separator />

          {/* Color Variant Preference */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                {t("settings.colorVariant.title")}
              </label>
              <p className="text-sm text-muted-foreground">
                {t(COLOR_VARIANTS.find(v => v.value === colorVariant)?.label || "")}
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              {/* Dropdown */}
              <div className="relative flex-1 w-full sm:w-auto min-w-[200px]" ref={colorVariantDropdownRef}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setColorVariantDropdownOpen(!colorVariantDropdownOpen)}
                  className="w-full justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                      style={{ backgroundColor: COLOR_VARIANTS.find(v => v.value === colorVariant)?.color }}
                    />
                    <span className="truncate">
                      {t(COLOR_VARIANTS.find(v => v.value === colorVariant)?.label || "")}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
                
                {colorVariantDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {COLOR_VARIANTS.map((variant) => (
                      <button
                        key={variant.value}
                        type="button"
                        onClick={() => handleColorVariantChange(variant.value)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground text-left"
                      >
                        <div
                          className="w-4 h-4 rounded-full border border-border/50 flex-shrink-0"
                          style={{ backgroundColor: variant.color }}
                        />
                        <span className="flex-1 truncate">{t(variant.label)}</span>
                        {colorVariant === variant.value && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color Preview */}
              <div className="flex gap-2 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md bg-primary shadow-sm border border-border transition-colors" />
                  <span className="text-[10px] text-muted-foreground">Primary</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md bg-secondary shadow-sm border border-border transition-colors" />
                  <span className="text-[10px] text-muted-foreground">Secondary</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md bg-accent shadow-sm border border-border transition-colors" />
                  <span className="text-[10px] text-muted-foreground">Accent</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-md bg-muted shadow-sm border border-border transition-colors" />
                  <span className="text-[10px] text-muted-foreground">Muted</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{t("profile.sessions.title")}</CardTitle>
                <CardDescription>{t("profile.sessions.description")}</CardDescription>
              </div>
            </div>
            <Button variant="destructive" size="sm" onClick={handleLogoutAll}>
              <LogOut className="h-4 w-4 mr-2" />
              {t("profile.sessions.logoutAll")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground mt-2">{t("common.loading")}</p>
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("profile.sessions.noSessions")}
            </p>
          ) : (
            <div className="space-y-4">
              {sessions.map((session, index) => (
                <div key={session.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {getBrowserName(session.user_agent)} • {getDeviceType(session.user_agent)}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>IP: {session.ip_address}</p>
                        <p>{t("profile.sessions.signedIn")}: {formatDate(session.created_at)}</p>
                        <p>{t("profile.sessions.expires")}: {formatDate(session.expires_at)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground bg-primary/5 px-2 py-1 rounded">
                      {t("profile.sessions.active")}
                    </div>
                  </div>
                  {index < sessions.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

