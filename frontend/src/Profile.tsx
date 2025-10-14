import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Monitor, Globe, Moon, Sun, LogOut } from "lucide-react";
import { api } from "@/lib/api";

interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  useEffect(() => {
    loadSessions();
  }, []);

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

