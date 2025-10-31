import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Activity, AlertTriangle, Download, Upload, PauseCircle, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/types/torrent';

interface ActiveTasksWidgetProps {
  tasks: Task[];
  title?: string;
}

const ActiveTasksWidget: React.FC<ActiveTasksWidgetProps> = ({ tasks, title = 'Active Tasks' }) => {
  const statusToCount = tasks.reduce<Record<string, number>>((acc, task) => {
    const status = (task.state || 'UNKNOWN').toUpperCase();
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(statusToCount);
  const isDownloadingStatus = (status: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    return (
      s === 'DOWNLOADING' ||
      s === 'FORCED_DOWNLOAD' ||
      s === 'FORCED_METADATA_DOWNLOAD' ||
      s === 'METADATA_DOWNLOAD'
    );
  };

  const isPausedOrUnknownStatus = (status: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    return (
      s === 'PAUSED_DOWNLOAD' ||
      s === 'PAUSED_UPLOAD' ||
      s === 'STOPPED_DOWNLOAD' ||
      s === 'STOPPED_UPLOAD' ||
      s === 'STALLED_DOWNLOAD' ||
      s === 'STALLED_UPLOAD' ||
      s === 'UNKNOWN'
    );
  };

  const getStatusRank = (status: string) => {
    const s = (status || 'UNKNOWN').toUpperCase();
    if (s === 'ERROR') return 0;
    if (isDownloadingStatus(s)) return 1;
    if (isPausedOrUnknownStatus(s)) return 3;
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
    switch (status) {
      case 'ERROR':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'DOWNLOADING':
      case 'FORCED_DOWNLOAD':
      case 'FORCED_METADATA_DOWNLOAD':
      case 'METADATA_DOWNLOAD':
        return <Download className="h-4 w-4 text-green-500" />;
      case 'UPLOADING':
      case 'SEEDING':
      case 'FORCED_UPLOAD':
      case 'CHECKING_UPLOAD':
      case 'FORCED_UPLOAD_METADATA':
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
      case 'COMPLETED':
      case 'CHECKING_RESUME_DATA':
      case 'MOVING':
        return <CheckCircle2 className="h-4 w-4 text-lime-500" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const total = tasks.length;
  const isActiveStatus = (status: string) => {
    const s = status.toUpperCase();
    return !(
      s === 'PAUSED_DOWNLOAD' ||
      s === 'PAUSED_UPLOAD' ||
      s === 'STALLED_DOWNLOAD' ||
      s === 'STALLED_UPLOAD' ||
      s === 'STOPPED_DOWNLOAD' ||
      s === 'STOPPED_UPLOAD' ||
      s === 'UNKNOWN'
    );
  };
  const active = tasks.filter(t => isActiveStatus(t.state || 'UNKNOWN')).length;


  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Activity className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{active.toString()}</div>
        <p className="text-xs text-muted-foreground mt-1">{`${total} total tasks`}</p>
        {top3.length > 0 && (
          <TooltipProvider>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {top3.map(([status, count]) => (
                <Tooltip key={status}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 cursor-help">
                      {getIcon(status)}
                      <span className="text-sm">{count}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{status}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        )}

      </CardContent>
    </Card>
  );
};

export default ActiveTasksWidget;


