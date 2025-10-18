// Settings.tsx
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Globe, Save, RotateCcw, Languages, Settings as SettingsIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

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

  useEffect(() => {
    // Load saved timezone from localStorage or detect system timezone
    const stored = localStorage.getItem("app_timezone");
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const initialTimezone = stored || detectedTimezone;
    
    setTimezone(initialTimezone);
    setSavedTimezone(initialTimezone);
  }, []);

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
        } catch (error) {
          setCurrentTime("Invalid timezone");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [timezone, i18n.language]);

  useEffect(() => {
    // Sync language state with i18n
    setLanguage(i18n.language);
    setSavedLanguage(i18n.language);
  }, [i18n.language]);

  const handleSaveTimezone = () => {
    localStorage.setItem("app_timezone", timezone);
    setSavedTimezone(timezone);
    
    alert(t("settings.timezone.saveSuccess") + `: ${timezone}`);
  };

  const handleResetTimezone = () => {
    const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(detectedTimezone);
  };

  const handleSaveLanguage = () => {
    i18n.changeLanguage(language);
    localStorage.setItem("app_language", language);
    setSavedLanguage(language);
    
    alert(t("settings.language.saveSuccess"));
  };

  const hasTimezoneChanges = timezone !== savedTimezone;
  const hasLanguageChanges = language !== savedLanguage;

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
              disabled={!hasLanguageChanges || !language}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {t("settings.language.saveChanges")}
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
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {t(`timezones.${tz}`)}
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
              disabled={!hasTimezoneChanges || !timezone}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {t("settings.timezone.saveChanges")}
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

      {/* Additional Settings Placeholder */}
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>{t("settings.other.title")}</CardTitle>
          <CardDescription>
            {t("settings.other.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t("settings.other.comingSoon")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
