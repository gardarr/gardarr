import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { setupService } from "@/services/setup";
import { SetupContext } from "./setup-context";

export { SetupContext };

/**
 * Initializes setup-related state on mount and provides `statisticsEnabled` and `loading` via SetupContext to descendant components.
 *
 * @returns A React element that wraps `children` with SetupContext.Provider supplying `{ statisticsEnabled, loading }`.
 */
export function SetupProvider({ children }: { children: ReactNode }) {
  const [statisticsEnabled, setStatisticsEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);

  const checkSetup = useCallback(async () => {
    try {
      const result = await setupService.checkSetup();
      setStatisticsEnabled(result.data?.statistics_enabled ?? true);
    } catch (error) {
      console.error("Failed to check setup status:", error);
      setStatisticsEnabled(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  return (
    <SetupContext.Provider value={{ statisticsEnabled, loading }}>
      {children}
    </SetupContext.Provider>
  );
}