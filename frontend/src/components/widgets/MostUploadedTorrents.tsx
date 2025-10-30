import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp } from "lucide-react";

interface TopUploadedItem {
  task: string;
  diff: number; // bytes uploaded increase in window
}

interface MostUploadedTorrentsProps {
  items?: TopUploadedItem[];
  taskNameById?: Record<string, string>;
}

export default function MostUploadedTorrents({ items, taskNameById }: MostUploadedTorrentsProps) {
  // Fallback to empty list if not provided
  const list: TopUploadedItem[] = items ?? [];

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
            {list.map((torrent, index) => {
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
                <div key={torrent.task} className={`flex items-center justify-between p-2 rounded transition-colors ${getHighlightClass()}`}>
                  <div className="flex-1 min-w-0 mr-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-sm font-medium truncate block cursor-help">
                          {taskNameById?.[torrent.task] ?? torrent.task}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{taskNameById?.[torrent.task] ?? torrent.task}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm text-muted-foreground flex-shrink-0">
                    {formatBytes(torrent.diff)}
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
