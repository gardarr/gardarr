import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/auth-hooks";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Monitor, Globe, Moon, Sun, LogOut, Lock, Eye, EyeOff, Settings, Palette, Minimize2 } from "lucide-react";
import { api } from "@/lib/api";
import { preferencesService } from "@/services/preferences";

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
  const [displayMode, setDisplayMode] = useState<"default" | "card">("default");
  const [compact, setCompact] = useState(false);
  const [blurIntensity, setBlurIntensity] = useState(50);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);

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
      setDisplayMode(cached.torrent_display_mode);
      setCompact(cached.compact);
      setBlurIntensity(cached.background_image_blur_intensity);
    }

    // Then fetch from API to ensure data is up to date
    try {
      const response = await api.get<{ torrent_display_mode: string; compact: boolean; background_image_blur_intensity: number }>("/profile/preferences");
      if (response.data) {
        const displayMode = response.data.torrent_display_mode as "default" | "card";
        setDisplayMode(displayMode);
        setCompact(response.data.compact);
        setBlurIntensity(response.data.background_image_blur_intensity);
        // Save to localStorage
        preferencesService.save({
          torrent_display_mode: displayMode,
          compact: response.data.compact,
          background_image_blur_intensity: response.data.background_image_blur_intensity
        });
      }
    } catch (error) {
      console.error("Failed to load preferences:", error);
    }
  };

  const updatePreference = async (key: string, value: unknown) => {
    setIsLoadingPreferences(true);
    try {
      const payload = { [key]: value };
      const response = await api.put<{ torrent_display_mode: string; compact: boolean; background_image_blur_intensity: number }>("/profile/preferences", payload);

      if (response.data) {
        const displayMode = response.data.torrent_display_mode as "default" | "card";
        setDisplayMode(displayMode);
        setCompact(response.data.compact);
        setBlurIntensity(response.data.background_image_blur_intensity);

        preferencesService.save({
          torrent_display_mode: displayMode,
          compact: response.data.compact,
          background_image_blur_intensity: response.data.background_image_blur_intensity
        });
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
    } finally {
      setIsLoadingPreferences(false);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">{t("profile.title")}</h1>
          <p className="text-muted-foreground">{t("profile.subtitle")}</p>
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
              {/* Torrent Display Mode */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {t("profile.display.torrentDisplayMode")}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.display.torrentDisplayModeDesc")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Default Mode */}
                  <button
                    onClick={() => updatePreference("torrent_display_mode", "default")}
                    disabled={isLoadingPreferences}
                    className={`relative p-4 rounded-lg border-2 transition-all hover:border-primary/50 ${displayMode === "default"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Default</div>
                      <div className="space-y-1.5">
                        <div className="h-2 bg-primary/20 rounded w-full"></div>
                        <div className="h-2 bg-primary/20 rounded w-full"></div>
                        <div className="h-2 bg-primary/20 rounded w-full"></div>
                      </div>
                    </div>
                    {displayMode === "default" && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>

                  {/* Card Mode */}
                  <button
                    onClick={() => updatePreference("torrent_display_mode", "card")}
                    disabled={isLoadingPreferences}
                    className={`relative p-4 rounded-lg border-2 transition-all hover:border-primary/50 ${displayMode === "card"
                      ? "border-primary bg-primary/5"
                      : "border-border"
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="space-y-2">
                      <div className="font-medium text-sm">Card</div>
                      <div className="space-y-2">
                        <div className="h-6 bg-primary/20 rounded w-full"></div>
                        <div className="h-6 bg-primary/20 rounded w-full"></div>
                      </div>
                    </div>
                    {displayMode === "card" && (
                      <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              <Separator />

              {/* Compact Mode Toggle */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Minimize2 className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">
                      {t("profile.display.compactMode")}
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.display.compactModeDesc")}
                  </p>
                </div>
                <button
                  onClick={() => updatePreference("compact", !compact)}
                  disabled={isLoadingPreferences}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${compact ? "bg-primary" : "bg-muted"
                    }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${compact ? "translate-x-6" : "translate-x-1"
                      }`}
                  />
                </button>
              </div>

              <Separator />

              {/* Background Image Blur Intensity */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <label className="text-sm font-medium">
                      {t("profile.display.blurIntensity")}
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("profile.display.blurIntensityDesc")}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={blurIntensity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      setBlurIntensity(value);
                    }}
                    onMouseUp={(e) => {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      updatePreference("background_image_blur_intensity", value);
                    }}
                    onTouchEnd={(e) => {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      updatePreference("background_image_blur_intensity", value);
                    }}
                    disabled={isLoadingPreferences}
                    className="flex-1 h-2 bg-muted rounded-lg appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0"
                  />
                  <span className="text-sm font-medium text-muted-foreground min-w-[3ch]">
                    {blurIntensity}
                  </span>
                </div>
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

