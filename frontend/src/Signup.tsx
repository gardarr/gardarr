import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, Mail, Lock, UserPlus, Sparkles } from "lucide-react";
import { signupService } from "./services/signup";
import { toast, Toaster } from "sonner";
import { useAuth } from "./contexts/auth-hooks";
import logoImage from "@/assets/img/logo/logo_64x64.png";
import { useTranslation } from "react-i18next";

export default function SignupPage() {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ email?: string; role: string; expires_at: string } | null>(null);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupChecked, setSetupChecked] = useState(false);

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

  // Check if system needs setup (only once)
  useEffect(() => {
    if (setupChecked) return;

    const checkSetup = async () => {
      try {
        const response = await signupService.needsSetup();
        if (response.data?.needs_setup) {
          // System not initialized, redirect to setup immediately
          navigate("/setup", { replace: true });
        }
      } catch (err) {
        console.error("Failed to check setup status:", err);
      } finally {
        setSetupChecked(true);
      }
    };

    checkSetup();
  }, [setupChecked, navigate]);

  // Check if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      toast.info(t('signup.mustBeLoggedOut'));
      navigate("/users");
    }
  }, [user, authLoading, navigate, t]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setValid(false);
      return;
    }

    // For now, assume token is valid and load form
    // In a production app, you'd validate the token first
    setLoading(false);
    setValid(true);
    setTokenInfo({
      role: 'user',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast.error("Invalid signup link");
      return;
    }

    // Validate form
    if (!email || !password) {
      toast.error(t('signup.fillAllFields'));
      return;
    }

    if (password.length < 8) {
      toast.error(t('signup.passwordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      toast.error(t('signup.passwordMismatch'));
      return;
    }

    try {
      setSubmitting(true);
      const response = await signupService.verifySignup({
        token,
        email,
        password,
      });

      if (response.error) {
        toast.error(response.error);
      } else {
        toast.success(t('signup.accountCreated'));
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('signup.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">{t('signup.validatingLink')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">{t('signup.invalidLink')}</h2>
            <p className="text-muted-foreground text-center mb-6">
              {t('signup.invalidLinkMessage')}
            </p>
            <Button onClick={() => navigate("/login")}>
              {t('signup.goToLogin')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 flex items-center justify-center p-4">
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
            <CardTitle className="text-2xl font-bold">{t('signup.title')}</CardTitle>
            <p className="text-muted-foreground text-sm">
              {t('signup.subtitle')}
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('signup.validMagicLink')}</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {tokenInfo?.email && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  <span>{t('signup.email')}: {tokenInfo.email}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <UserPlus className="h-3 w-3" />
                <span>{t('signup.role')}: {tokenInfo?.role}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                <span>{t('signup.expires')}: {tokenInfo ? new Date(tokenInfo.expires_at).toLocaleString() : ''}</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('signup.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!tokenInfo?.email || submitting}
                  className="pl-10"
                  required
                />
              </div>
              {tokenInfo?.email && (
                <p className="text-xs text-muted-foreground">{t('signup.emailPreFilled')}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('signup.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder={t('signup.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('signup.confirmPassword')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t('signup.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                  disabled={submitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full mt-6"
              disabled={submitting}
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {t('signup.creatingAccount')}
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {t('signup.createAccount')}
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground pt-4">
              {t('signup.alreadyHaveAccount')}{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-normal text-primary"
                onClick={() => navigate("/login")}
                type="button"
              >
                {t('signup.signIn')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

