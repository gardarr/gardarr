// DashboardPage.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, Download, Users, HardDrive, Activity, Clock } from "lucide-react";

export default function DashboardPage() {
  const stats = [
    { 
      title: "Downloads Ativos", 
      value: "24", 
      icon: Download,
      description: "+12% em relação ao mês passado",
      color: "text-blue-500"
    },
    { 
      title: "Usuários Online", 
      value: "156", 
      icon: Users,
      description: "12 usuários ativos agora",
      color: "text-green-500"
    },
    { 
      title: "Espaço Utilizado", 
      value: "2.4 TB", 
      icon: HardDrive,
      description: "78% da capacidade total",
      color: "text-orange-500"
    },
    { 
      title: "Velocidade Média", 
      value: "45 MB/s", 
      icon: Activity,
      description: "Taxa de transferência atual",
      color: "text-purple-500"
    },
    { 
      title: "Tempo Médio", 
      value: "2.3h", 
      icon: Clock,
      description: "Tempo médio de download",
      color: "text-cyan-500"
    },
    { 
      title: "Taxa de Sucesso", 
      value: "98.5%", 
      icon: BarChart3,
      description: "Downloads completados com sucesso",
      color: "text-emerald-500"
    },
  ];

  return (
    <div className="space-y-6">
      {/* Título da página */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do seu servidor Seedbox
          </p>
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
            <CardTitle>Downloads Recentes</CardTitle>
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
                    {item.progress}% completo
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Atividade do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { time: "2 min atrás", event: "Novo usuário registrado", type: "info" },
                { time: "5 min atrás", event: "Download iniciado: Ubuntu", type: "success" },
                { time: "12 min atrás", event: "Espaço em disco baixo", type: "warning" },
                { time: "18 min atrás", event: "Backup automático concluído", type: "success" },
                { time: "25 min atrás", event: "Usuário desconectado", type: "info" },
              ].map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{activity.event}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
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
