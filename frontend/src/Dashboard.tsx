// DashboardPage.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, Download, Users, HardDrive, Activity, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function DashboardPage() {
  const { t } = useTranslation();
  
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
      title: t("dashboard.usedSpace"), 
      value: "2.4 TB", 
      icon: HardDrive,
      description: t("dashboard.usedSpaceDesc"),
      color: "text-orange-500"
    },
    { 
      title: t("dashboard.averageSpeed"), 
      value: "45 MB/s", 
      icon: Activity,
      description: t("dashboard.averageSpeedDesc"),
      color: "text-purple-500"
    },
    { 
      title: t("dashboard.averageTime"), 
      value: "2.3h", 
      icon: Clock,
      description: t("dashboard.averageTimeDesc"),
      color: "text-cyan-500"
    },
    { 
      title: t("dashboard.successRate"), 
      value: "98.5%", 
      icon: BarChart3,
      description: t("dashboard.successRateDesc"),
      color: "text-emerald-500"
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
      </div>

      {/* Seção de atividades recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentDownloads")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: "Ubuntu 22.04 LTS", progress: 85, size: "4.2 GB" },
                { name: "Windows 11 ISO", progress: 42, size: "5.8 GB" },
                { name: "Debian 12", progress: 100, size: "3.9 GB" },
                { name: "CentOS Stream", progress: 67, size: "9.1 GB" },
              ].map((item, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-muted-foreground">{item.size}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all duration-300" 
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.progress}% {t("dashboard.complete")}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.systemActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { time: "2", event: t("dashboard.activities.newUser"), type: "info" },
                { time: "5", event: t("dashboard.activities.downloadStarted"), type: "success" },
                { time: "12", event: t("dashboard.activities.lowDiskSpace"), type: "warning" },
                { time: "18", event: t("dashboard.activities.backupCompleted"), type: "success" },
                { time: "25", event: t("dashboard.activities.userDisconnected"), type: "info" },
              ].map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.event}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.time} {parseInt(activity.time) === 1 ? t("dashboard.timeAgo.minAgo") : t("dashboard.timeAgo.minsAgo")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
