import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import type { Task } from "@/types/torrent";
import { formatTimeAgo } from "@/utils/timeUtils";

interface RecentCreatedTorrentsProps {
  items?: Task[];
  limit?: number;
}

export default function RecentCreatedTorrents({ items, limit }: RecentCreatedTorrentsProps) {
  const sorted = (items ?? [])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, typeof limit === 'number' ? limit : undefined);

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
          {sorted.length === 0 ? (
            <div className="text-xs text-muted-foreground">No recent torrents</div>
          ) : (
            sorted.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-2 rounded hover:bg-accent/50 transition-colors">
                <span className="text-sm font-medium truncate flex-1 min-w-0 mr-3">
                  {t.name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatTimeAgo(t.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
