import { Server, type LucideIcon } from "lucide-react";
import { availableIcons } from "./worker-icons";

interface WorkerIconProps {
  iconName?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getWorkerIcon(iconName?: string): LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>> {
  if (!iconName) return Server;
  const iconItem = availableIcons.find(i => i.name === iconName);
  return iconItem ? iconItem.icon : Server;
}

export function WorkerIcon({ 
  iconName, 
  color = "#3b82f6", 
  size = "md", 
  className = "",
}: WorkerIconProps) {
  const IconComponent = getWorkerIcon(iconName);
  
  // Size configurations
  const sizeConfig = {
    sm: {
      container: "w-4 h-4",
      icon: "h-3.5 w-3.5"
    },
    md: {
      container: "w-5 h-5", 
      icon: "h-4.5 w-4.5"
    },
    lg: {
      container: "w-6 h-6",
      icon: "h-5.5 w-5.5"
    }
  };
  
  const config = sizeConfig[size];
  
  const textColorClass = 'text-white';
  
  return (
    <div
      className={`${config.container} rounded-sm flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
    >
      {iconName === "QBittorrent" ? (
        <IconComponent className={`${config.icon} ${textColorClass}`} size={size} />
      ) : (
        <IconComponent className={`${config.icon} ${textColorClass}`} />
      )}
    </div>
  );
}

