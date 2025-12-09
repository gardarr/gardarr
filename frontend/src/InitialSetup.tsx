import { useCallback, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, UserPlus, Sparkles, Shield, Server } from "lucide-react";
import { signupService } from "./services/signup";
import { toast, Toaster } from "sonner";
import logoImage from "@/assets/img/logo/logo_64x64.png";
import { useTranslation } from "react-i18next";
import { 
  PasswordInput, 
  CenteredCard, 
  CONTAINER_CLASSES, 
  MIN_PASSWORD_LENGTH, 
  REDIRECT_DELAY 
} from "@/components/auth/PasswordInput";

export default function InitialSetupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Set dark theme as default on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const shouldBeDark = stored ? stored === "dark" : true;
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const checkSetupStatus = useCallback(async () => {
    try {
      setLoading(true);
      const response = await signupService.needsSetup();

      if (response.error) {
        toast.error(response.error);
        setNeedsSetup(false);
      } else if (response.data?.needs_setup) {
        setNeedsSetup(true);
      } else {
        toast.info(t('initialSetup.systemConfigured'));
        setTimeout(() => navigate("/login"), REDIRECT_DELAY);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check setup status");
      setNeedsSetup(false);
    } finally {
      setLoading(false);
    }
  }, [navigate, t]);

  // Check if system needs setup
  useEffect(() => {
    checkSetupStatus();
  }, [checkSetupStatus]);

  const validateForm = () => {
    if (!email || !password) {
      toast.error(t('initialSetup.fillAllFields'));
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t('initialSetup.passwordTooShort'));
      return false;
    }

    if (password !== confirmPassword) {
      toast.error(t('initialSetup.passwordMismatch'));
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      const response = await signupService.publicSignup({
        email,
        password,
      });

      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(t('initialSetup.accountCreated'));
        setTimeout(() => navigate("/login"), REDIRECT_DELAY);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('initialSetup.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <CenteredCard>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">{t('initialSetup.checkingStatus')}</p>
        </CardContent>
      </CenteredCard>
    );
  }

  if (!needsSetup) {
    return (
      <CenteredCard>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Server className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">{t('initialSetup.alreadyConfigured')}</h2>
          <p className="text-muted-foreground text-center mb-6">
            {t('initialSetup.alreadyConfiguredMessage')}
          </p>
          <Button onClick={() => navigate("/login")}>
            {t('initialSetup.goToLogin')}
          </Button>
        </CardContent>
      </CenteredCard>
    );
  }

  return (
    <div className={CONTAINER_CLASSES}>
      <Toaster richColors />
      <Card className="w-full max-w-md border-border/50 shadow-lg">
        <CardHeader className="space-y-4 pb-6">
          <div className="flex items-center justify-center">
            <div className="h-16 w-16 rounded-2xl overflow-hidden flex items-center justify-center bg-primary/10 p-2.5">
              <img 
                src={logoImage} 
                alt="Gardarr Logo" 
                className="h-full w-full object-contain"
              />
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold">{t('initialSetup.title')}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t('initialSetup.subtitle')}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('initialSetup.firstTimeSetup')}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>{t('initialSetup.adminPrivileges')}</span>
              </div>
              <div className="flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                <span>{t('initialSetup.inviteUsersLater')}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('initialSetup.adminEmail')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="pl-10"
                  required
                  autoFocus
                />
              </div>
            </div>

            <PasswordInput
              id="password"
              label={t('initialSetup.password')}
              placeholder={t('initialSetup.passwordPlaceholder')}
              value={password}
              onChange={setPassword}
              disabled={submitting}
            />

            <PasswordInput
              id="confirmPassword"
              label={t('initialSetup.confirmPassword')}
              placeholder={t('initialSetup.confirmPasswordPlaceholder')}
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={submitting}
            />

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={submitting}
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('initialSetup.creatingAccount')}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-2" />
                  {t('initialSetup.createAdminAccount')}
                </>
              )}
            </Button>

            <div className="text-center text-xs text-muted-foreground pt-4 space-y-1">
              <p>{t('initialSetup.oneTimeSetup')}</p>
              <p>{t('initialSetup.afterSetup')}</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

