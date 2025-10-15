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
const availableIcons: { name: string; icon: LucideIcon }[] = [
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

interface CategoryIconProps {
  iconName?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getCategoryIcon(iconName?: string): LucideIcon {
  if (!iconName) return Folder;
  const iconItem = availableIcons.find(i => i.name === iconName);
  return iconItem ? iconItem.icon : Folder;
}

export function CategoryIcon({ 
  iconName, 
  color = "#3b82f6", 
  size = "md", 
  className = "" 
}: CategoryIconProps) {
  const IconComponent = getCategoryIcon(iconName);
  
  // Size configurations
  const sizeConfig = {
    sm: {
      container: "w-4 h-4",
      icon: "h-2.5 w-2.5"
    },
    md: {
      container: "w-5 h-5", 
      icon: "h-3 w-3"
    },
    lg: {
      container: "w-6 h-6",
      icon: "h-4 w-4"
    }
  };
  
  const config = sizeConfig[size];
  
  return (
    <div
      className={`${config.container} rounded-sm flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      <IconComponent className={`${config.icon} text-white`} />
    </div>
  );
}

// Export the available icons for other components that might need them
export { availableIcons };
