export type LimitMode = "global" | "unlimited" | "custom";

/**
 * Get limit mode from a limit value
 */
export function getLimitMode(value: number): LimitMode {
  if (value === -2) return "global";
  if (value === -1) return "unlimited";
  return "custom";
}

/**
 * Get limit value from mode
 */
export function getLimitValue(mode: LimitMode, currentValue: number = 0): number {
  if (mode === "global") return -2;
  if (mode === "unlimited") return -1;
  return currentValue < 0 ? 0 : currentValue;
}

/**
 * Sync limit modes from loaded limits data
 */
export function syncLimitModes(limits: {
  ratio_limit: number;
  seeding_time_limit: number;
  inactive_seeding_time_limit: number;
}): {
  ratioMode: LimitMode;
  seedingTimeMode: LimitMode;
  inactiveSeedingTimeMode: LimitMode;
} {
  return {
    ratioMode: getLimitMode(limits.ratio_limit),
    seedingTimeMode: getLimitMode(limits.seeding_time_limit),
    inactiveSeedingTimeMode: getLimitMode(limits.inactive_seeding_time_limit),
  };
}

