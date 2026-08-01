import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/auth-hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { User, Monitor, Globe, Moon, Sun, LogOut, Lock, Eye, EyeOff, Settings, Palette, Check, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { preferencesService, type UserPreferences } from "@/services/preferences";
import { toast } from "sonner";
import { ColorPicker } from "@/components/ColorPicker";

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}


interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps) {
  return (
    <CardHeader>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
      </div>
    </CardHeader>
  );
}

interface PasswordInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  requirements?: string;
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  required = false,
  minLength,
  requirements
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          className="pr-10"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {requirements && (
        <p className="text-xs text-muted-foreground">
          {requirements}
        </p>
      )}
    </div>
  );
}
export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  // Preferences state
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);

  // Color Palettes state - consolidated into structured objects for cleaner state management
  const [palettes, setPalettes] = useState({
    palette1: {
      primary: "#3b82f6",
      secondary: "#8b5cf6",
      accent: "#10b981",
      muted: "#6b7280"
    },
    palette2: {
      primary: "#ef4444",
      secondary: "#f59e0b",
      accent: "#ec4899",
      muted: "#78716c"
    },
    palette3: {
      primary: "#06b6d4",
      secondary: "#14b8a6",
      accent: "#a855f7",
      muted: "#64748b"
    }
  });

  useEffect(() => {
    loadSessions();
    loadPreferences();
  }, []);

  // Observe theme changes from external sources (like header menu)
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const hasDark = document.documentElement.classList.contains('dark');
          setIsDark(hasDark);
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);


  const loadSessions = async () => {
    setIsLoading(true);
    const response = await api.get<Session[]>("/auth/sessions");
    if (response.data) {
      setSessions(response.data);
    }
    setIsLoading(false);
  };

  const loadPreferences = async () => {
    // First try to load from localStorage
    const cached = preferencesService.load();
    if (cached) {
      setPalettes({
        palette1: {
          primary: cached.color_palette_1_primary,
          secondary: cached.color_palette_1_secondary,
          accent: cached.color_palette_1_accent,
          muted: cached.color_palette_1_muted
        },
        palette2: {
          primary: cached.color_palette_2_primary,
          secondary: cached.color_palette_2_secondary,
          accent: cached.color_palette_2_accent,
          muted: cached.color_palette_2_muted
        },
        palette3: {
          primary: cached.color_palette_3_primary,
          secondary: cached.color_palette_3_secondary,
          accent: cached.color_palette_3_accent,
          muted: cached.color_palette_3_muted
        }
      });
    }

    // Then fetch from API to ensure data is up to date
    try {
      const response = await api.get<UserPreferences>("/profile/preferences");
      if (response.data) {
        setPalettes({
          palette1: {
            primary: response.data.color_palette_1_primary,
            secondary: response.data.color_palette_1_secondary,
            accent: response.data.color_palette_1_accent,
            muted: response.data.color_palette_1_muted
          },
          palette2: {
            primary: response.data.color_palette_2_primary,
            secondary: response.data.color_palette_2_secondary,
            accent: response.data.color_palette_2_accent,
            muted: response.data.color_palette_2_muted
          },
          palette3: {
            primary: response.data.color_palette_3_primary,
            secondary: response.data.color_palette_3_secondary,
            accent: response.data.color_palette_3_accent,
            muted: response.data.color_palette_3_muted
          }
        });
        // Save to localStorage
        preferencesService.save(response.data);
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  // Debounce timer ref for color updates to reduce API calls during rapid changes
  const colorDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  const updatePreference = useCallback(async (key: string, value: unknown) => {
    setIsLoadingPreferences(true);
    try {
      const payload = { [key]: value };
      const response = await api.put<UserPreferences>("/profile/preferences", payload);

      if (response.data) {
        setPalettes({
          palette1: {
            primary: response.data.color_palette_1_primary,
            secondary: response.data.color_palette_1_secondary,
            accent: response.data.color_palette_1_accent,
            muted: response.data.color_palette_1_muted
          },
          palette2: {
            primary: response.data.color_palette_2_primary,
            secondary: response.data.color_palette_2_secondary,
            accent: response.data.color_palette_2_accent,
            muted: response.data.color_palette_2_muted
          },
          palette3: {
            primary: response.data.color_palette_3_primary,
            secondary: response.data.color_palette_3_secondary,
            accent: response.data.color_palette_3_accent,
            muted: response.data.color_palette_3_muted
          }
        });

        preferencesService.save(response.data);

        // Dispatch custom event to notify other components
        window.dispatchEvent(new Event('preferencesUpdated'));

        toast.success(t("profile.display.preferencesSaved"), {
          icon: <Check className="h-4 w-4" />,
          duration: 2000,
        });
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      toast.error(t("profile.display.preferencesError"));
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [t]);

  // Debounced color update handler - waits 500ms after the last change before making API call
  const updateColorDebounced = useCallback((key: string, value: string) => {
    // Clear existing timer for this key
    if (colorDebounceTimers.current[key]) {
      clearTimeout(colorDebounceTimers.current[key]);
    }

    // Update local state immediately for responsive UI
    setPalettes(prev => {
      const [, paletteNum, colorType] = key.match(/color_palette_(\d+)_(\w+)/) || [];
      if (!paletteNum || !colorType) return prev;

      const paletteKey = `palette${paletteNum}` as 'palette1' | 'palette2' | 'palette3';
      return {
        ...prev,
        [paletteKey]: {
          ...prev[paletteKey],
          [colorType]: value
        }
      };
    });

    // Debounce the API call
    colorDebounceTimers.current[key] = setTimeout(() => {
      updatePreference(key, value);
    }, 500);
  }, [updatePreference]);

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


  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    // Validation
    if (newPassword.length < 8) {
      setPasswordError(t("profile.security.passwordTooShort"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(t("profile.security.passwordMismatch"));
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await api.put("/profile/password", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (response.data) {
        setPasswordSuccess(t("profile.security.passwordChanged"));
        // Clear form
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error: unknown) {
      const errorMessage = error && typeof error === 'object' && 'response' in error
        ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
        : undefined;
      setPasswordError(errorMessage || t("profile.security.passwordChangeFailed"));
    } finally {
      setIsChangingPassword(false);
    }
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
          <h1 className="text-2xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            {t("profile.tabs.general")}
          </TabsTrigger>
          <TabsTrigger value="display" className="gap-2">
            <Palette className="h-4 w-4" />
            {t("profile.tabs.display")}
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock className="h-4 w-4" />
            {t("profile.tabs.security")}
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          {/* Personal Information */}
          <Card>
            <SectionHeader
              icon={User}
              title={t("profile.personalInfo.title")}
              description={t("profile.personalInfo.description")}
            />
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
            <SectionHeader
              icon={Globe}
              title={t("profile.preferences.title")}
              description={t("profile.preferences.description")}
            />
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


            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <SectionHeader
              icon={Palette}
              title={t("profile.display.title")}
              description={t("profile.display.description")}
            />
            <CardContent className="space-y-6">
              {/* Color Palettes */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">
                      {t("profile.display.colorPalettes")}
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.display.colorPalettesDesc")}
                  </p>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  {/* Palette 1 */}
                  <AccordionItem value="palette-1" className="border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette1.primary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette1.secondary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette1.accent }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette1.muted }} />
                        </div>
                        <span className="text-sm font-medium">{t("profile.display.palette1")}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <ColorPicker
                          label={t("profile.display.primary")}
                          value={palettes.palette1.primary}
                          onChange={(c) => updateColorDebounced("color_palette_1_primary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.secondary")}
                          value={palettes.palette1.secondary}
                          onChange={(c) => updateColorDebounced("color_palette_1_secondary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.accent")}
                          value={palettes.palette1.accent}
                          onChange={(c) => updateColorDebounced("color_palette_1_accent", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.muted")}
                          value={palettes.palette1.muted}
                          onChange={(c) => updateColorDebounced("color_palette_1_muted", c)}
                          disabled={isLoadingPreferences}
                        />
                      </div>
                      {/* Preview Card */}
                      <div className="rounded-lg border bg-card">
                        <div className="p-3 flex items-center gap-3 border-b">
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: palettes.palette1.primary }}
                          >
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{t("profile.display.previewTitle")}</p>
                            <p className="text-xs" style={{ color: palettes.palette1.muted }}>{t("profile.display.previewText")}</p>
                          </div>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette1.primary, color: '#fff' }}
                          >
                            {t("profile.display.primary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette1.secondary, color: '#fff' }}
                          >
                            {t("profile.display.secondary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette1.accent, color: '#fff' }}
                          >
                            {t("profile.display.accent")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette1.muted + '20', color: palettes.palette1.muted, borderColor: palettes.palette1.muted }}
                          >
                            {t("profile.display.muted")}
                          </button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Palette 2 */}
                  <AccordionItem value="palette-2" className="border rounded-lg px-4 mt-2">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette2.primary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette2.secondary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette2.accent }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette2.muted }} />
                        </div>
                        <span className="text-sm font-medium">{t("profile.display.palette2")}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <ColorPicker
                          label={t("profile.display.primary")}
                          value={palettes.palette2.primary}
                          onChange={(c) => updateColorDebounced("color_palette_2_primary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.secondary")}
                          value={palettes.palette2.secondary}
                          onChange={(c) => updateColorDebounced("color_palette_2_secondary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.accent")}
                          value={palettes.palette2.accent}
                          onChange={(c) => updateColorDebounced("color_palette_2_accent", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.muted")}
                          value={palettes.palette2.muted}
                          onChange={(c) => updateColorDebounced("color_palette_2_muted", c)}
                          disabled={isLoadingPreferences}
                        />
                      </div>
                      {/* Preview Card */}
                      <div className="rounded-lg border bg-card">
                        <div className="p-3 flex items-center gap-3 border-b">
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: palettes.palette2.primary }}
                          >
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{t("profile.display.previewTitle")}</p>
                            <p className="text-xs" style={{ color: palettes.palette2.muted }}>{t("profile.display.previewText")}</p>
                          </div>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette2.primary, color: '#fff' }}
                          >
                            {t("profile.display.primary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette2.secondary, color: '#fff' }}
                          >
                            {t("profile.display.secondary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette2.accent, color: '#fff' }}
                          >
                            {t("profile.display.accent")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette2.muted + '20', color: palettes.palette2.muted, borderColor: palettes.palette2.muted }}
                          >
                            {t("profile.display.muted")}
                          </button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* Palette 3 */}
                  <AccordionItem value="palette-3" className="border rounded-lg px-4 mt-2">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette3.primary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette3.secondary }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette3.accent }} />
                          <div className="w-4 h-4 rounded-sm border" style={{ backgroundColor: palettes.palette3.muted }} />
                        </div>
                        <span className="text-sm font-medium">{t("profile.display.palette3")}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                        <ColorPicker
                          label={t("profile.display.primary")}
                          value={palettes.palette3.primary}
                          onChange={(c) => updateColorDebounced("color_palette_3_primary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.secondary")}
                          value={palettes.palette3.secondary}
                          onChange={(c) => updateColorDebounced("color_palette_3_secondary", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.accent")}
                          value={palettes.palette3.accent}
                          onChange={(c) => updateColorDebounced("color_palette_3_accent", c)}
                          disabled={isLoadingPreferences}
                        />
                        <ColorPicker
                          label={t("profile.display.muted")}
                          value={palettes.palette3.muted}
                          onChange={(c) => updateColorDebounced("color_palette_3_muted", c)}
                          disabled={isLoadingPreferences}
                        />
                      </div>
                      {/* Preview Card */}
                      <div className="rounded-lg border bg-card">
                        <div className="p-3 flex items-center gap-3 border-b">
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center"
                            style={{ backgroundColor: palettes.palette3.primary }}
                          >
                            <Sparkles className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{t("profile.display.previewTitle")}</p>
                            <p className="text-xs" style={{ color: palettes.palette3.muted }}>{t("profile.display.previewText")}</p>
                          </div>
                        </div>
                        <div className="p-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette3.primary, color: '#fff' }}
                          >
                            {t("profile.display.primary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette3.secondary, color: '#fff' }}
                          >
                            {t("profile.display.secondary")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette3.accent, color: '#fff' }}
                          >
                            {t("profile.display.accent")}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-md border transition-opacity hover:opacity-80"
                            style={{ backgroundColor: palettes.palette3.muted + '20', color: palettes.palette3.muted, borderColor: palettes.palette3.muted }}
                          >
                            {t("profile.display.muted")}
                          </button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Security - Password Change */}
          <Card>
            <SectionHeader
              icon={Lock}
              title={t("profile.security.title")}
              description={t("profile.security.description")}
            />
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <PasswordInput
                  id="current-password"
                  label={t("profile.security.currentPassword")}
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  required
                  placeholder={t("profile.security.enterCurrentPassword")}
                />

                <Separator />

                <PasswordInput
                  id="new-password"
                  label={t("profile.security.newPassword")}
                  value={newPassword}
                  onChange={setNewPassword}
                  required
                  minLength={8}
                  placeholder={t("profile.security.enterNewPassword")}
                  requirements={t("profile.security.passwordRequirements")}
                />

                <PasswordInput
                  id="confirm-password"
                  label={t("profile.security.confirmPassword")}
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  required
                  placeholder={t("profile.security.enterConfirmPassword")}
                />

                {/* Error Message */}
                {passwordError && (
                  <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {passwordError}
                  </div>
                )}

                {/* Success Message */}
                {passwordSuccess && (
                  <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
                    {passwordSuccess}
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="w-full"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {t("profile.security.changingPassword")}
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 mr-2" />
                      {t("profile.security.changePassword")}
                    </>
                  )}
                </Button>
              </form>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
