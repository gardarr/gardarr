import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";

interface TorrentUploadData {
  id: string;
  name: string;
  uploadBytes: number;
}

export default function MostUploadedTorrents() {
  // Mock data for most uploaded torrents
  const mockTorrents: TorrentUploadData[] = [
    {
      id: "1",
      name: "Ubuntu 22.04 LTS Desktop 2025-10-20",
      uploadBytes: 125829120, // ~120 MB
    },
    {
      id: "2", 
      name: "Windows 11 Pro ISO",
      uploadBytes: 94371840, // ~90 MB
    },
    {
      id: "3",
      name: "Debian 12 Netinst",
      uploadBytes: 83886080, // ~80 MB
    },
    {
      id: "4",
      name: "CentOS Stream 9",
      uploadBytes: 73400320, // ~70 MB
    },
    {
      id: "5",
      name: "macOS Monterey",
      uploadBytes: 62914560, // ~60 MB
    }
  ];

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top Uploaded Torrents
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {mockTorrents.map((torrent, index) => {
              const getHighlightClass = () => {
                switch (index) {
                  case 0:
                    return "bg-primary/15 hover:bg-primary/25";
                  case 1:
                    return "bg-primary/10 hover:bg-primary/20";
                  case 2:
                    return "bg-primary/5 hover:bg-primary/15";
                  default:
                    return "hover:bg-accent/50";
                }
              };

              return (
                <div key={torrent.id} className={`flex items-center justify-between p-2 rounded transition-colors ${getHighlightClass()}`}>
                  <div className="flex-1 min-w-0 mr-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium truncate block cursor-help">
                          {torrent.name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{torrent.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0">
                    {formatBytes(torrent.uploadBytes)}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
