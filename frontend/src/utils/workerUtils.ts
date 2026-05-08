import {
  Server,
  Database,
  Cloud,
  Monitor,
  Cpu,
  MemoryStick,
  HardDriveIcon,
  Globe,
  Router,
  Network,
  Download,
  Upload,
  FileText,
  Music,
  Video,
  Image,
  Archive,
  Folder,
  Zap,
  Shield,
  type LucideIcon
} from "lucide-react";
import { QBittorrentIcon } from "../components/ui/QBittorrentIcon";

// Available icons for workers
export const availableIcons: { name: string; icon: LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { name: "Server", icon: Server },
  { name: "Database", icon: Database },
  { name: "Cloud", icon: Cloud },
  { name: "Monitor", icon: Monitor },
  { name: "Cpu", icon: Cpu },
  { name: "MemoryStick", icon: MemoryStick },
  { name: "HardDrive", icon: HardDriveIcon },
  { name: "Globe", icon: Globe },
  { name: "Router", icon: Router },
  { name: "Network", icon: Network },
  { name: "Download", icon: Download },
  { name: "Upload", icon: Upload },
  { name: "FileText", icon: FileText },
  { name: "Music", icon: Music },
  { name: "Video", icon: Video },
  { name: "Image", icon: Image },
  { name: "Archive", icon: Archive },
  { name: "Folder", icon: Folder },
  { name: "Zap", icon: Zap },
  { name: "Shield", icon: Shield },
  { name: "QBittorrent", icon: QBittorrentIcon },
];

// Available colors for workers
export const availableColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#6b7280" }
];

/**
 * Get the correct icon component based on the icon name
 * @param iconName - The name of the icon
 * @returns The icon component, defaults to Server if not found
 */
export const getWorkerIcon = (iconName?: string): LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  const icon = availableIcons.find(i => i.name === iconName);
  return icon ? icon.icon : Server;
};

/**
 * Get the color value by name
 * @param colorName - The name of the color
 * @returns The color hex value, defaults to blue if not found
 */
export const getWorkerColor = (colorName?: string): string => {
  const color = availableColors.find(c => c.name.toLowerCase() === colorName?.toLowerCase());
  return color ? color.value : "#3b82f6";
};
