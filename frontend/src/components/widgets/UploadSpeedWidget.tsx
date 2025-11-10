import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { formatBytesPerSecond } from '@/utils/bytes';

interface UploadSpeedWidgetProps {
  speedBytesPerSecond: number;
  subtitle?: string;
}

const UploadSpeedWidget: React.FC<UploadSpeedWidgetProps> = ({ 
  speedBytesPerSecond, 
  subtitle 
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Upload Speed
        </CardTitle>
        <Upload className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatBytesPerSecond(speedBytesPerSecond)}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default UploadSpeedWidget;

