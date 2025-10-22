import { Server, type LucideIcon } from "lucide-react";
import { availableIcons } from "./agent-icons";

interface AgentIconProps {
  iconName?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  standalone?: boolean;
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
  className = "",
  standalone = false
}: AgentIconProps) {
  const IconComponent = getAgentIcon(iconName);
  
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
  
  // For standalone agents, use appropriate text color based on theme
  const textColorClass = standalone ? 'text-primary-foreground' : 'text-white';
  
  return (
    <div
      className={`${config.container} rounded-sm flex items-center justify-center flex-shrink-0 ${className} ${
        standalone ? 'bg-primary' : ''
      }`}
      style={!standalone ? { backgroundColor: color } : {}}
    >
      {iconName === "QBittorrent" ? (
        <IconComponent className={`${config.icon} ${textColorClass}`} size={size} />
      ) : (
        <IconComponent className={`${config.icon} ${textColorClass}`} />
      )}
    </div>
  );
}

