import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConnectedSeedersCardProps {
  connectedSeeders?: number;
  totalSeeders?: number;
}

export default function ConnectedSeedersCard({ 
  connectedSeeders = 12, 
  totalSeeders = 89 
}: ConnectedSeedersCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("dashboard.connectedSeeders")}
        </CardTitle>
        <div className="flex items-center space-x-0.5">
          <Users className="h-4 w-4 text-green-500" />
          <ArrowUp className="h-3 w-3 text-green-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{connectedSeeders}</div>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="text-green-500 font-semibold">{totalSeeders}</span> {t("dashboard.seedersInSwarm").replace("{{count}}", "")}
        </p>
      </CardContent>
    </Card>
  );
}
