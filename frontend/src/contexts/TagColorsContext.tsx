import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { TagColorsContext, type TagColorsContextValue } from "@/contexts/tag-colors-context";
import { tagService } from "@/services/tags";

export function TagColorsProvider({ children }: { children: ReactNode }) {
  const [tagColors, setTagColors] = useState<Map<string, string>>(new Map());
  const [scopeColors, setScopeColors] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    const response = await tagService.listTags();
    if (!response.data) return;

    const nextTagColors = new Map<string, string>();
    const nextScopeColors = new Map<string, string>();
    for (const tag of response.data) {
      if (!tag.color) continue;
      if (tag.kind === "scope") {
        nextScopeColors.set(tag.name, tag.color);
      } else {
        nextTagColors.set(tag.name, tag.color);
      }
    }
    setTagColors(nextTagColors);
    setScopeColors(nextScopeColors);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getTagColor = useCallback((name: string) => tagColors.get(name), [tagColors]);
  const getScopeColor = useCallback((scopeKey: string) => scopeColors.get(scopeKey), [scopeColors]);

  const value = useMemo<TagColorsContextValue>(
    () => ({ getTagColor, getScopeColor, refresh }),
    [getTagColor, getScopeColor, refresh]
  );

  return <TagColorsContext.Provider value={value}>{children}</TagColorsContext.Provider>;
}
