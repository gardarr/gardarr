import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import { formatBytes } from '@/utils/bytes';

interface AgentTotalDownloadedSizeProps {
  bytes: number; // active amount
  totalBytes: number; // all-time total
  title?: string;
}

const AgentTotalDownloadedSize: React.FC<AgentTotalDownloadedSizeProps> = ({ bytes, totalBytes, title = 'Total Downloaded' }) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Download className="h-4 w-4 text-green-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatBytes(bytes)}</div>
        <p className="text-xs text-muted-foreground mt-1">{formatBytes(totalBytes)} all time</p>
      </CardContent>
    </Card>
  );
};

export default AgentTotalDownloadedSize;


