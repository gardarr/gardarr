import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";

interface RecentTorrent {
  id: string;
  name: string;
  timestamp: Date;
}

export default function RecentCreatedTorrents() {
  // const { t } = useTranslation(); // Removed unused variable

  // Mock data for recently created torrents
  const mockTorrents: RecentTorrent[] = [
    {
      id: "1",
      name: "Ubuntu 22.04 LTS Desktop 2025-10-20",
      timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    },
    {
      id: "2",
      name: "Windows 11 Pro ISO",
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    },
    {
      id: "3",
      name: "Debian 12 Netinst",
      timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    },
    {
      id: "4",
      name: "CentOS Stream 9",
      timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    },
    {
      id: "5",
      name: "macOS Monterey",
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    }
  ];

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) {
      return "Just now";
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else {
      const diffInHours = Math.floor(diffInMinutes / 60);
      return `${diffInHours}h ago`;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recent Created Torrents
        </CardTitle>
        <Plus className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockTorrents.map((torrent) => (
            <div key={torrent.id} className="flex items-center justify-between p-2 rounded hover:bg-accent/50 transition-colors">
              <span className="text-sm font-medium truncate flex-1 min-w-0 mr-3">
                {torrent.name}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTimeAgo(torrent.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
