import { useCallback, useEffect, useState } from "react";
import { preferencesService } from "@/services/preferences";

export function useTorrentBlurIntensity() {
  const [blurIntensity, setBlurIntensity] = useState(50);

  useEffect(() => {
    const prefs = preferencesService.load();
    if (typeof prefs?.background_image_blur_intensity === "number") {
      setBlurIntensity(prefs.background_image_blur_intensity);
    }
  }, []);

  return blurIntensity;
}

export function useTorrentOpenHandler({
  torrentId,
  selectionMode,
  onToggleSelect,
  onShowDetails,
}: {
  torrentId: string;
  selectionMode?: boolean;
  onToggleSelect?: (id: string) => void;
  onShowDetails: (id: string) => void;
}) {
  return useCallback(() => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect(torrentId);
      return;
    }

    onShowDetails(torrentId);
  }, [onShowDetails, onToggleSelect, selectionMode, torrentId]);
}

export function getBlurPixels(blurIntensity: number) {
  return Math.round((blurIntensity / 100) * 24);
}
