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

// Available icons for agents
const availableIcons: { name: string; icon: LucideIcon }[] = [
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
  { name: "Shield", icon: Shield }
];

interface AgentIconProps {
  iconName?: string;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

function getAgentIcon(iconName?: string): LucideIcon {
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
      <IconComponent className={`${config.icon} text-white`} />
    </div>
  );
}

// Export the available icons for other components that might need them
export { availableIcons };
