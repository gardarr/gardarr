import { useContext } from "react";
import { SetupContext } from "./SetupContext";

export function useSetup() {
  const context = useContext(SetupContext);
  if (context === undefined) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
}
