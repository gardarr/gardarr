import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HardDrive } from 'lucide-react';
import { formatBytes } from '@/utils/bytes';

interface TotalStorageWidgetProps {
  totalBytes: number;
  subtitle?: string;
  title?: string;
}

const TotalStorageWidget: React.FC<TotalStorageWidgetProps> = ({ totalBytes, subtitle, title = 'Total Storage' }) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <HardDrive className="h-4 w-4 text-blue-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatBytes(totalBytes)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
};

export default TotalStorageWidget;


