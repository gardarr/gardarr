// DashboardPage.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, Download, Users, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import MostUploadedTorrents from "@/components/widgets/MostUploadedTorrents";
import ConnectedPeersCard from "@/components/widgets/ConnectedPeersCard";
import ConnectedSeedersCard from "@/components/widgets/ConnectedSeedersCard";
import RecentCreatedTorrents from "@/components/widgets/RecentCreatedTorrents";
import MostUsedCategoriesWidget from "@/components/widgets/MostUsedCategoriesWidget";
import UsedSpaceWidget from "@/components/widgets/UsedSpaceWidget";
import DateRangePicker from "@/components/DateRangePicker";

export default function DashboardPage() {
  const { t } = useTranslation();
  const [fromDate, setFromDate] = useState<Date | undefined>(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)); // 7 days ago
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  
  const stats = [
    { 
      title: t("dashboard.activeDownloads"), 
      value: "24", 
      icon: Download,
      description: t("dashboard.activeDownloadsDesc"),
      color: "text-blue-500"
    },
    { 
      title: t("dashboard.onlineUsers"), 
      value: "156", 
      icon: Users,
      description: t("dashboard.onlineUsersDesc"),
      color: "text-green-500"
    },
    { 
      title: t("dashboard.averageSpeed"), 
      value: "45 MB/s", 
      icon: Activity,
      description: t("dashboard.averageSpeedDesc"),
      color: "text-purple-500"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Título da página */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-muted-foreground">
              {t("dashboard.subtitle")}
            </p>
          </div>
        </div>
        
        {/* Date Range Selector */}
        <DateRangePicker
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
        />
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <Card key={stat.title} className="hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <IconComponent className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
        
        {/* Used Space Widget */}
        <UsedSpaceWidget />
        
        {/* Connected Seeders Card */}
        <ConnectedSeedersCard />
        
        {/* Connected Peers Card */}
        <ConnectedPeersCard />
      </div>

      {/* Seção de atividades recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Created Torrents Card */}
        <RecentCreatedTorrents />

        {/* Most Used Categories & Tags Widget */}
        <MostUsedCategoriesWidget />

        {/* Most Uploaded Torrents Card */}
        <MostUploadedTorrents />
      </div>
    </div>
  );
}
