import { useEffect, useState } from "react";
import { X, Share, Plus } from "lucide-react";
import { Button } from "./ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * PWA Install Prompt component
 * Shows installation instructions for iOS and handles the install prompt for Android/Desktop
 */
export function InstallPrompt() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showDesktopPrompt, setShowDesktopPrompt] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches 
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    const dismissed = localStorage.getItem("pwa-prompt-dismissed");
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);

    // Don't show if already installed or dismissed within last 7 days
    if (isStandalone || (dismissed && daysSinceDismissed < 7)) {
      return;
    }

    // iOS detection
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
    
    if (isIOS) {
      // Delay showing iOS prompt slightly for better UX
      const timer = setTimeout(() => setShowIOSPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Desktop - listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowDesktopPrompt(true), 2000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("pwa-prompt-dismissed", Date.now().toString());
    setShowIOSPrompt(false);
    setShowDesktopPrompt(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      setShowDesktopPrompt(false);
    }
    setDeferredPrompt(null);
  };

  // iOS Install Prompt
  if (showIOSPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Install Gardarr</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Add to your home screen for quick access
              </p>
              <ol className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium">1</span>
                  <span className="flex items-center gap-1">
                    Tap <Share className="w-4 h-4 inline text-primary" /> Share
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-medium">2</span>
                  <span className="flex items-center gap-1">
                    Select <Plus className="w-4 h-4 inline text-primary" /> Add to Home Screen
                  </span>
                </li>
              </ol>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 -mt-1 -mr-1"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Desktop/Android Install Prompt
  if (showDesktopPrompt && deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="bg-card border border-border rounded-lg shadow-lg p-4 max-w-md mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h3 className="font-semibold text-foreground mb-2">Install Gardarr</h3>
              <p className="text-sm text-muted-foreground mb-3">
                Install the app for a better experience with offline support
              </p>
              <div className="flex gap-2">
                <Button onClick={handleInstall} size="sm">
                  Install
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss}>
                  Not now
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 -mt-1 -mr-1"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
