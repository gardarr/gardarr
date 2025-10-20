import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Users, ArrowDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ConnectedPeersCardProps {
  connectedPeers?: number;
  totalPeers?: number;
}

export default function ConnectedPeersCard({ 
  connectedPeers = 24, 
  totalPeers = 156 
}: ConnectedPeersCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("dashboard.connectedPeers")}
        </CardTitle>
        <div className="flex items-center space-x-0.5">
          <Users className="h-4 w-4 text-blue-500" />
          <ArrowDown className="h-3 w-3 text-blue-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{connectedPeers}</div>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="text-blue-500 font-semibold">{totalPeers}</span> {t("dashboard.peersInSwarm").replace("{{count}}", "")}
        </p>
      </CardContent>
    </Card>
  );
}
