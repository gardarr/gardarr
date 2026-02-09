import { createContext } from "react";

export interface SetupContextType {
  statisticsEnabled: boolean;
  loading: boolean;
}

export const SetupContext = createContext<SetupContextType | undefined>(undefined);
