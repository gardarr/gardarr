import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { setupService } from "@/services/setup";
import { SetupContext } from "./SetupContextBase";
import type { SetupStatus } from "@/types/setup";

export function SetupProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [loading, setLoading] = useState<boolean>(true);
    const [status, setStatus] = useState<SetupStatus | null>(null);

    const checkSetup = useCallback(async () => {
        try {
            setLoading(true);
            const result = await setupService.checkSetup();
            if (result.data) {
                setStatus(result.data);
            } else {
                setStatus(null);
            }
        } catch (error) {
            console.error("Failed to check setup status:", error);
            setStatus(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkSetup();
    }, [checkSetup]);

    const contextValue = useMemo(() => ({
        loading,
        checkSetup,
        status
    }), [loading, checkSetup, status]);

    return (
        <SetupContext.Provider value={contextValue}>
            {children}
        </SetupContext.Provider>
    );
}

// useSetup moved to SetupContextBase.ts to fix ESLint react-refresh/only-export-components
