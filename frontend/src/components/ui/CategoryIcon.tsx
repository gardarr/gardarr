import { Folder, type LucideIcon } from "lucide-react";
import { availableIcons } from "./category-icons";

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

