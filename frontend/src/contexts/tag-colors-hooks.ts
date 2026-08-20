import { useContext } from "react";
import { TagColorsContext, type TagColorsContextValue } from "@/contexts/tag-colors-context";

// Unlike useAddTorrent, this never throws outside its provider: TagBadge is
// a leaf, widely-reused component (including in isolation in tests), and
// coloring is a decorative enhancement - falling back to no colors is the
// right degradation, not an error.
const noopTagColors: TagColorsContextValue = {
  getTagColor: () => undefined,
  getScopeColor: () => undefined,
  refresh: () => {},
};

export function useTagColors(): TagColorsContextValue {
  return useContext(TagColorsContext) ?? noopTagColors;
}
