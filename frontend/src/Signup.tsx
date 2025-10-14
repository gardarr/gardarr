import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus } from "lucide-react";
import logoImage from "@/assets/img/logo/logo_128x128.png";

export default function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Set dark theme as default on mount
  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const shouldBeDark = stored ? stored === "dark" : true; // Default to dark
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError(t("auth.signup.passwordMismatch"));
      return;
    }

    // Validate password length
    if (password.length < 8) {
      setError(t("auth.signup.passwordTooShort"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(email, password);
      
      if (result.error) {
        setError(result.error);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(t("common.error"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/5 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo and title */}
        <div className="flex flex-col items-center space-y-3">
          <div className="h-16 w-16 rounded-2xl overflow-hidden flex items-center justify-center bg-primary/10 p-2.5">
            <img 
              src={logoImage} 
              alt="Gardarr Logo" 
              className="h-full w-full object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Gardarr</h1>
        </div>

        {/* Signup form */}
        <Card className="border-border/50">
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle className="text-xl">{t("auth.signup.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("auth.signup.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("auth.signup.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("auth.signup.password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("auth.signup.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t("auth.signup.confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </CardContent>
            <CardFooter className="flex-col space-y-3 pt-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>{t("common.loading")}</>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {t("auth.signup.submit")}
                  </>
                )}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                {t("auth.signup.hasAccount")}{" "}
                <Link
                  to="/login"
                  className="text-primary font-medium hover:underline"
                >
                  {t("auth.signup.loginLink")}
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}

