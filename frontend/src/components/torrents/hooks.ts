import { useCallback, useEffect, useState } from "react";
import { preferencesService } from "@/services/preferences";

export function useTorrentBlurIntensity() {
  const [blurIntensity, setBlurIntensity] = useState(50);

  useEffect(() => {
    const load = () => {
      const prefs = preferencesService.load();
      const value = Number(prefs?.background_image_blur_intensity);
      setBlurIntensity(isNaN(value) ? 50 : Math.max(0, Math.min(100, value)));
    };

    load();
    window.addEventListener("storage", load);
    window.addEventListener("preferencesUpdated", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("preferencesUpdated", load);
    };
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
