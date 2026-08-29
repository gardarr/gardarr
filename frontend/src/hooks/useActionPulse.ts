import { useEffect, useRef, useState } from "react";

// Transient "just clicked this direction" feedback for the queue-priority
// buttons: optimistic (fires on click, not on API response) since failures
// already surface via toast.error separately. `token` changes on every
// trigger so consumers can use it as a React key to restart CSS animations
// even on repeated clicks of the same action.
export function useActionPulse<T extends string>(durationMs = 600) {
  const [pulsed, setPulsed] = useState<{ action: T; token: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const trigger = (action: T) => {
    clearTimeout(timeoutRef.current);
    setPulsed({ action, token: Date.now() });
    timeoutRef.current = setTimeout(() => setPulsed(null), durationMs);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return { pulsedAction: pulsed?.action ?? null, pulseToken: pulsed?.token ?? 0, trigger };
}
