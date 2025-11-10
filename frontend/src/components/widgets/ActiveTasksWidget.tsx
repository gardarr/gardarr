import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, AlertTriangle, Download, Upload, PauseCircle, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/types/torrent';
import { normalizeTaskStatus, isDownloadStatus, isInactiveStatus } from '@/utils/statusUtils';

interface ActiveTasksWidgetProps {
  tasks: Task[];
  title?: string;
}

const ActiveTasksWidget: React.FC<ActiveTasksWidgetProps> = ({ tasks, title = 'Active Tasks' }) => {
  const statusToCount = tasks.reduce<Record<string, number>>((acc, task) => {
    const status = normalizeTaskStatus(task.state || 'UNKNOWN');
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(statusToCount);

  const getStatusRank = (status: string) => {
    const normalizedStatus = normalizeTaskStatus(status);
    if (normalizedStatus === 'ERROR') return 0;
    if (isDownloadStatus(normalizedStatus)) return 1;
    if (isInactiveStatus(normalizedStatus) || normalizedStatus === 'UNKNOWN') return 3;
    return 2;
  };

  entries.sort((a, b) => {
    const [sa, ca] = a;
    const [sb, cb] = b;
    const ra = getStatusRank(sa);
    const rb = getStatusRank(sb);
    if (ra !== rb) return ra - rb;
    return cb - ca;
  });

  const top3 = entries.slice(0, 3);

  const getIcon = (status: string) => {
    const normalizedStatus = normalizeTaskStatus(status);
    switch (normalizedStatus) {
      case 'ERROR':
      case 'MISSING_FILES':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'DOWNLOADING':
      case 'FORCED_DOWNLOAD':
      case 'FORCED_METADATA_DOWNLOAD':
      case 'METADATA_DOWNLOAD':
        return <Download className="h-4 w-4 text-green-500" />;
      case 'UPLOADING':
      case 'FORCED_UPLOAD':
      case 'CHECKING_UPLOAD':
        return <Upload className="h-4 w-4 text-purple-500" />;
      case 'PAUSED_DOWNLOAD':
      case 'PAUSED_UPLOAD':
      case 'STOPPED_DOWNLOAD':
      case 'STOPPED_UPLOAD':
      case 'QUEUED_UPLOAD':
      case 'STALLED_UPLOAD':
      case 'QUEUED_DOWNLOAD':
      case 'STALLED_DOWNLOAD':
        return <PauseCircle className="h-4 w-4 text-muted-foreground" />;
      case 'CHECKING_RESUME_DATA':
      case 'MOVING':
        return <CheckCircle2 className="h-4 w-4 text-lime-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const total = tasks.length;


  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Activity className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        {top3.length > 0 ? (
          <TooltipProvider>
            <div className="text-2xl font-bold">
              <div className="grid grid-cols-3 gap-2">
                {top3.map(([status, count]) => (
                  <Tooltip key={status}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center gap-2 cursor-help">
                        {getIcon(status)}
                        <span>{count}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{status}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          </TooltipProvider>
        ) : (
          <div className="text-2xl font-bold">0</div>
        )}
        {total > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {`${total} total tasks`}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveTasksWidget;


