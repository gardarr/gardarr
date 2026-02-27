import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { setupService } from "@/services/setup";
import { SetupContext } from "./SetupContextBase";
import type { SetupStatus } from "@/types/setup";

export function SetupProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [statisticsEnabled, setStatisticsEnabled] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(true);
    const [status, setStatus] = useState<SetupStatus | null>(null);

    const checkSetup = useCallback(async () => {
        try {
            setLoading(true);
            const result = await setupService.checkSetup();
            if (result.data) {
                setStatus(result.data);
                setStatisticsEnabled(result.data.statistics_enabled ?? true);
            } else {
                setStatus(null);
                setStatisticsEnabled(true);
            }
        } catch (error) {
            console.error("Failed to check setup status:", error);
            setStatus(null);
            setStatisticsEnabled(true); // Default to true on error to avoid blocking UI
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSetup();
    }, [checkSetup]);

    const contextValue = useMemo(() => ({
        statisticsEnabled,
        loading,
        checkSetup,
        status
    }), [statisticsEnabled, loading, checkSetup, status]);

    return (
        <SetupContext.Provider value={contextValue}>
            {children}
        </SetupContext.Provider>
    );
}

// useSetup moved to SetupContextBase.ts to fix ESLint react-refresh/only-export-components
