import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function UsedSpaceWidget() {
  const { t } = useTranslation();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("dashboard.usedSpace")}
        </CardTitle>
        <HardDrive className="h-4 w-4 text-orange-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">2.4 TB</div>
        <p className="text-xs text-muted-foreground mt-1">
        78% {t("dashboard.usedSpaceDesc")}
        </p>
      </CardContent>
    </Card>
  );
}
