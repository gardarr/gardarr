// Service worker registration for the PWA.
//
// Registration used to live inline in index.html; it now lives here so the
// React layer can react to updates (see UpdatePrompt) and trigger activation.

type UpdateHandler = (registration: ServiceWorkerRegistration) => void;

/**
 * Registers /sw.js on window load. Calls `onUpdate` with the registration when a
 * new worker has installed and is waiting to activate (i.e. an update is ready),
 * and reloads the page once the new worker takes control.
 */
export function registerServiceWorker(onUpdate?: UpdateHandler): void {
  if (!("serviceWorker" in navigator)) return;

  const doRegister = () => {
    // Reload once the freshly activated worker takes control of the page.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // A worker may already be waiting (update installed on a previous visit).
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdate?.(registration);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            // "installed" + an existing controller means this is an update,
            // not the first install.
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              onUpdate?.(registration);
            }
          });
        });
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });
  };

  // If `load` already fired before this runs (e.g. React mounts after the
  // page finished loading), a `load` listener registered now would never
  // fire, so register immediately in that case instead.
  if (document.readyState === "complete") {
    doRegister();
  } else {
    window.addEventListener("load", doRegister, { once: true });
  }
}

/** Tells the waiting worker to activate; the controllerchange listener reloads. */
export function applyServiceWorkerUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: "SKIP_WAITING" });
}
