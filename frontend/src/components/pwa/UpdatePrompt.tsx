import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { registerServiceWorker, applyServiceWorkerUpdate } from "@/lib/registerSW";

/**
 * Registers the service worker and, when a new version has installed and is
 * waiting, shows a persistent toast that activates it (which reloads the page).
 * Renders nothing.
 */
export function UpdatePrompt() {
  const { t } = useTranslation();
  const shown = useRef(false);

  useEffect(() => {
    registerServiceWorker((registration) => {
      if (shown.current) return;
      shown.current = true;
      toast(t("pwa.update.title"), {
        description: t("pwa.update.description"),
        duration: Infinity,
        action: {
          label: t("pwa.update.action"),
          onClick: () => applyServiceWorkerUpdate(registration),
        },
      });
    });
  }, [t]);

  return null;
}
