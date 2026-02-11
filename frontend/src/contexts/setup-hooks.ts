import { useContext } from "react";
import { SetupContext } from "./SetupContext";

/**
 * Accesses the current setup context.
 *
 * @returns The value provided by `SetupProvider`.
 * @throws Error if called outside of a `SetupProvider`.
 */
export function useSetup() {
  const context = useContext(SetupContext);
  if (context === undefined) {
    throw new Error("useSetup must be used within a SetupProvider");
  }
  return context;
}