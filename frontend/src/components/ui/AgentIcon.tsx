import { Server, type LucideIcon } from "lucide-react";
import { availableIcons } from "./agent-icons";

interface AgentIconProps {
  iconName?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getAgentIcon(iconName?: string): LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>> {
  if (!iconName) return Server;
  const iconItem = availableIcons.find(i => i.name === iconName);
  return iconItem ? iconItem.icon : Server;
}

export function AgentIcon({ 
  iconName, 
  color = "#3b82f6", 
  size = "md", 
  className = "" 
}: AgentIconProps) {
  const IconComponent = getAgentIcon(iconName);
  
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
      {iconName === "QBittorrent" ? (
        <IconComponent className={`${config.icon} text-white`} size={size} />
      ) : (
        <IconComponent className={`${config.icon} text-white`} />
      )}
    </div>
  );
}

