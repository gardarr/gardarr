import { createContext } from "react";

export interface TagColorsContextValue {
  // Exact color override for a full tag name (a stored "tag" kind row),
  // e.g. "quality::4k" colored differently from the rest of "quality::*".
  getTagColor: (name: string) => string | undefined;
  // Shared color for every "key::*" tag under a scope (a stored "scope"
  // kind row), e.g. every "quality::*" tag sharing one hue.
  getScopeColor: (scopeKey: string) => string | undefined;
  refresh: () => void;
}

export const TagColorsContext = createContext<TagColorsContextValue | undefined>(undefined);
