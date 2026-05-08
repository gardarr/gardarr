import { createContext, useContext } from "react";
import type { SetupStatus } from "@/types/setup";

export interface SetupContextState {
    loading: boolean;
    checkSetup: () => Promise<void>;
    status: SetupStatus | null;
}

export const SetupContext = createContext<SetupContextState | undefined>(undefined);

export function useSetup(): SetupContextState {
    const context = useContext(SetupContext);
    if (context === undefined) {
        throw new Error("useSetup must be used within a SetupProvider");
    }
    return context;
}
