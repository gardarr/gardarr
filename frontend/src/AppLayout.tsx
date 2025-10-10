// AppLayout.tsx
import { Button } from "@/components/ui/button";
import { Home, Settings, Users, BarChart3, Download, Menu, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageTransition from "@/components/PageTransition";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === "dark" : prefersDark;
    if (dark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setIsDark(root.classList.contains('dark'));
  }, []);

  function toggleTheme() {
    const root = document.documentElement;
    const nextDark = !root.classList.contains('dark');
    if (nextDark) {
      root.classList.add('dark');
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove('dark');
      localStorage.setItem("theme", "light");
    }
    setIsDark(nextDark);
  }

  const menuItems = [
    { href: "/dashboard", icon: Home, label: "Dashboard" },
    { href: "/torrents", icon: Download, label: "Torrents" },
    { href: "/agents", icon: Users, label: "Agents" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar Esquerda - Simples e direta */}
      <div 
        className={`bg-sidebar border-r border-border transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
      >
        {/* Header da Sidebar */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">S</span>
            </div>
            {sidebarOpen && (
              <span className="font-semibold text-lg whitespace-nowrap">Seedbox</span>
            )}
          </div>
        </div>
        
        {/* Menu de Navegação */}
        <nav className="p-2 flex-1 overflow-auto">
          <ul className="space-y-1">
            {menuItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="whitespace-nowrap">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Footer da Sidebar */}
        <div className="border-t border-border p-2 mt-auto">
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            {sidebarOpen && (
              <span className="whitespace-nowrap">Configurações</span>
            )}
          </Link>
        </div>
      </div>

      {/* Conteúdo Principal - Ocupa todo o espaço restante */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">
              {location.pathname === "/dashboard" && "Dashboard"}
              {location.pathname === "/torrents" && "Torrents"}
              {location.pathname === "/instances" && "Instances"}
              {location.pathname === "/agents" && "Agents"}
              {location.pathname === "/analytics" && "Analytics"}
              {location.pathname === "/settings" && "Configurações"}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Alternar tema" onClick={toggleTheme} className="h-8 w-8">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm">
              <Users className="h-4 w-4 mr-2" />
              Perfil
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Configurações
            </Button>
          </div>
        </header>
        
        {/* Conteúdo da Rota */}
        <main className="flex-1 overflow-auto p-6">
          <div className="w-full max-w-7xl mx-auto">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
