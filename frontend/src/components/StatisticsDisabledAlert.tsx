import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatisticsDisabledAlertProps {
  statisticsEnabled: boolean;
}

const StatisticsDisabledAlert: React.FC<StatisticsDisabledAlertProps> = ({ statisticsEnabled }) => {
  const { t } = useTranslation();

  if (statisticsEnabled) {
    return null;
  }

  return (
    <Card className="py-4">
      <CardContent className="flex items-center gap-3 py-0">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="h-4 w-4 text-primary" />
        </div>
        <div className="text-sm text-muted-foreground">
          {t("dashboard.statisticsDisabled")}
        </div>
      </CardContent>
    </Card>
  );
};

export default StatisticsDisabledAlert;

