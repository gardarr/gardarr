export interface UserPreferences {
  torrent_display_mode: "default" | "card";
  compact: boolean;
  background_image_blur_intensity: number;
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
      torrent_display_mode: "default",
      compact: false,
      background_image_blur_intensity: 50,
    };
  },
};
