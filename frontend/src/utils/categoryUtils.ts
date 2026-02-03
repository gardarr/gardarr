import { 
  Folder, 
  FolderOpen,
  Film,
  Tv,
  Music,
  BookOpen,
  Gamepad2,
  FileText,
  Image,
  Video,
  Download,
  Star,
  Heart,
  Archive,
  Package,
  Disc,
  type LucideIcon
} from "lucide-react";

// Available icons for categories
export const availableIcons: { name: string; icon: LucideIcon }[] = [
  { name: "Folder", icon: Folder },
  { name: "FolderOpen", icon: FolderOpen },
  { name: "Film", icon: Film },
  { name: "Tv", icon: Tv },
  { name: "Music", icon: Music },
  { name: "BookOpen", icon: BookOpen },
  { name: "Gamepad2", icon: Gamepad2 },
  { name: "FileText", icon: FileText },
  { name: "Image", icon: Image },
  { name: "Video", icon: Video },
  { name: "Download", icon: Download },
  { name: "Star", icon: Star },
  { name: "Heart", icon: Heart },
  { name: "Archive", icon: Archive },
  { name: "Package", icon: Package },
  { name: "Disc", icon: Disc }
];

// Available colors for categories (ordered in rainbow spectrum)
export const availableColors = [
  { name: "Red", value: "#ef4444" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Pink", value: "#ec4899" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#10b981" },
  { name: "Emerald", value: "#059669" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#7c3aed" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Slate", value: "#475569" },
  { name: "Gray", value: "#6b7280" },
  { name: "Zinc", value: "#52525b" }
];

/**
 * Get the correct icon component based on the icon name
 * @param iconName - The name of the icon
 * @returns The Lucide icon component, defaults to Folder if not found
 */
export const getCategoryIcon = (iconName?: string): LucideIcon => {
  const icon = availableIcons.find(i => i.name === iconName);
  return icon ? icon.icon : Folder;
};

/**
 * Get the color value by name
 * @param colorName - The name of the color
 * @returns The color hex value, defaults to blue if not found
 */
export const getCategoryColor = (colorName?: string): string => {
  const color = availableColors.find(c => c.name.toLowerCase() === colorName?.toLowerCase());
  return color ? color.value : "#3b82f6";
};
