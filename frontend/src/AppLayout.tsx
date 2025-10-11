// AppLayout.tsx
import { Button } from "@/components/ui/button";
import { Home, Settings, Users, BarChart3, Download, Menu, Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { useTranslation } from "react-i18next";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState(false);
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

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
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
    { href: "/dashboard", icon: Home, label: t("navigation.dashboard") },
    { href: "/torrents", icon: Download, label: t("navigation.torrents") },
    { href: "/agents", icon: Users, label: t("navigation.agents") },
    { href: "/analytics", icon: BarChart3, label: t("navigation.analytics") },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Esquerda - Responsiva para mobile */}
      <div 
        className={`bg-sidebar border-r border-border transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-16'
        } ${
          sidebarOpen 
            ? 'fixed inset-y-0 left-0 z-50 w-64 md:relative md:z-auto' 
            : 'hidden md:flex'
        }`}
      >
        {/* Header da Sidebar */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
              <span className="text-primary-foreground font-bold text-sm">G</span>
            </div>
            {(sidebarOpen || isMobile) && (
              <span className="font-semibold text-lg whitespace-nowrap">Gardarr</span>
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
                    onClick={() => isMobile && setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    {(sidebarOpen || isMobile) && (
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
            onClick={() => isMobile && setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              location.pathname === "/settings"
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            {(sidebarOpen || isMobile) && (
              <span className="whitespace-nowrap">{t("navigation.settings")}</span>
            )}
          </Link>
        </div>
      </div>

      {/* Conteúdo Principal - Ocupa todo o espaço restante */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 md:block hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">
              {location.pathname === "/dashboard" && t("navigation.dashboard")}
              {location.pathname === "/torrents" && t("navigation.torrents")}
              {location.pathname === "/instances" && "Instances"}
              {location.pathname === "/agents" && t("navigation.agents")}
              {location.pathname === "/analytics" && t("navigation.analytics")}
              {location.pathname === "/settings" && t("navigation.settings")}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} onClick={toggleTheme} className="h-8 w-8">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Users className="h-4 w-4 mr-2" />
              {t("navigation.profile")}
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex" asChild>
              <Link to="/settings">
                <Settings className="h-4 w-4 mr-2" />
                {t("navigation.settings")}
              </Link>
            </Button>
          </div>
        </header>
        
        {/* Conteúdo da Rota */}
        <main className="flex-1 overflow-auto p-4 md:p-6 min-h-0">
          <div className="w-full max-w-7xl mx-auto h-full">
            <PageTransition>
              {children}
            </PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
