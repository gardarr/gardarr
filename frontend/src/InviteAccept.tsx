import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, Loader2, CheckCircle, XCircle, Mail, Lock } from "lucide-react";
import { inviteService } from "./services/invites";
import { signupService } from "./services/signup";
import type { Invite } from "./types/invite";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ui/toast-container";
import logoImage from "@/assets/img/logo/logo_64x64.png";

function InviteAccept() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<Invite | null>(null);
  const [valid, setValid] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [setupChecked, setSetupChecked] = useState(false);
  const { toasts, showSuccess, showError, showInfo, removeToast } = useToast();

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

  useEffect(() => {
    if (code) {
      validateInvite();
    }
  }, [code]);

  const validateInvite = async () => {
    if (!code) return;

    try {
      setLoading(true);
      const response = await inviteService.validateInvite(code);

      if (response.error || !response.data) {
        showError(response.error || "Invalid invite code");
        setValid(false);
      } else if (response.data.valid && response.data.invite) {
        setValid(true);
        setInvite(response.data.invite);
        // Pre-fill email if invite is specific
        if (response.data.invite.email) {
          setEmail(response.data.invite.email);
        }
      } else {
        showError("This invite is no longer valid");
        setValid(false);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to validate invite");
      setValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code) return;

    // Validate form
    if (!email || !password) {
      showError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      showError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }

    try {
      setSubmitting(true);
      const response = await inviteService.acceptInvite({
        code,
        email,
        password,
      });

      if (response.error) {
        showError(response.error);
      } else {
        showSuccess("Account created successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!valid || !invite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invalid Invite</h2>
            <p className="text-muted-foreground text-center mb-6">
              This invite link is invalid, expired, or has already been used.
            </p>
            <Button onClick={() => navigate("/login")}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-center">
            <img 
              src={logoImage} 
              alt="Gardarr Logo" 
              className="h-16 w-16"
            />
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold">Accept Invitation</CardTitle>
            <p className="text-muted-foreground mt-2">
              Create your account to get started
            </p>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-3 bg-accent/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium">Valid Invitation</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              {invite.email && (
                <div>Email: {invite.email}</div>
              )}
              <div>Role: {invite.role}</div>
              <div>Expires: {new Date(invite.expires_at).toLocaleString()}</div>
            </div>
          </div>

          <form onSubmit={handleAcceptInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!!invite.email}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Accept Invite & Create Account
                </>
              )}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={() => navigate("/login")}
              >
                Sign in
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default InviteAccept;

