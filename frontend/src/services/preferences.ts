export interface UserPreferences {
  torrent_display_mode: "table" | "card" | "card_b" | "list";
  compact: boolean;
  background_image_blur_intensity: number;
  active_color_palette: number;
  // Color Palette 1
  color_palette_1_primary: string;
  color_palette_1_secondary: string;
  color_palette_1_accent: string;
  color_palette_1_muted: string;
  // Color Palette 2
  color_palette_2_primary: string;
  color_palette_2_secondary: string;
  color_palette_2_accent: string;
  color_palette_2_muted: string;
  // Color Palette 3
  color_palette_3_primary: string;
  color_palette_3_secondary: string;
  color_palette_3_accent: string;
  color_palette_3_muted: string;
}

const PREFERENCES_KEY = "user_preferences";

export const preferencesService = {
  // Save preferences to localStorage
  save(preferences: UserPreferences): void {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save preferences to localStorage:", error);
    }
  },

  // Load preferences from localStorage
  load(): UserPreferences | null {
    try {
      const stored = localStorage.getItem(PREFERENCES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Failed to load preferences from localStorage:", error);
    }
    return null;
  },

  // Clear preferences from localStorage
  clear(): void {
    try {
      localStorage.removeItem(PREFERENCES_KEY);
    } catch (error) {
      console.error("Failed to clear preferences from localStorage:", error);
    }
  },

  // Get default preferences
  getDefaults(): UserPreferences {
    return {
      torrent_display_mode: "card",
      compact: false,
      background_image_blur_intensity: 50,
      active_color_palette: 1,
      color_palette_1_primary: "#3b82f6",
      color_palette_1_secondary: "#8b5cf6",
      color_palette_1_accent: "#10b981",
      color_palette_1_muted: "#6b7280",
      color_palette_2_primary: "#ef4444",
      color_palette_2_secondary: "#f59e0b",
      color_palette_2_accent: "#ec4899",
      color_palette_2_muted: "#78716c",
      color_palette_3_primary: "#06b6d4",
      color_palette_3_secondary: "#14b8a6",
      color_palette_3_accent: "#a855f7",
      color_palette_3_muted: "#64748b",
    };
  },
};
