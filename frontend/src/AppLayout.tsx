// AppLayout.tsx
import { Button } from "@/components/ui/button";
import { Home, Settings, Users, BarChart3, Download, Menu, Sun, Moon, Info, LogOut, FolderOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import logoImage from "@/assets/img/logo/logo_64x64.png";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem("theme");
    // Default to dark theme if no preference is stored
    const dark = stored ? stored === "dark" : true;
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

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menuItems = [
    { href: "/dashboard", icon: Home, label: t("navigation.dashboard") },
    { href: "/torrents", icon: Download, label: t("navigation.torrents") },
    { href: "/agents", icon: Users, label: t("navigation.agents") },
    { href: "/categories", icon: FolderOpen, label: t("navigation.categories") },
    { href: "/analytics", icon: BarChart3, label: t("navigation.analytics") },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar Esquerda - Responsiva para mobile */}
      <div 
        className={`bg-sidebar border-r border-border flex-col transition-all duration-300 ease-in-out overflow-hidden
          ${sidebarOpen 
            ? 'flex fixed inset-y-0 left-0 z-50 w-64 translate-x-0 md:relative md:z-auto md:w-64' 
            : 'fixed inset-y-0 left-0 z-50 w-64 -translate-x-full md:flex md:relative md:translate-x-0 md:w-16'
          }`}
      >
        {/* Header da Sidebar */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
              <img 
                src={logoImage} 
                alt="Gardarr Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <span className={`font-semibold text-lg whitespace-nowrap transition-all duration-200 overflow-hidden ${
              sidebarOpen || isMobile ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
            }`}>
              Gardarr
            </span>
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
                    className={`flex items-center px-3 py-2 rounded-md transition-all ${
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-sidebar-foreground hover:bg-primary/90 hover:text-primary-foreground"
                    } ${!sidebarOpen && !isMobile ? 'justify-center' : 'gap-3'}`}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <span className={`whitespace-nowrap transition-all duration-200 overflow-hidden ${
                      sidebarOpen || isMobile ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
                    }`}>
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        
        {/* Footer da Sidebar */}
        <div className="border-t border-border p-2 mt-auto space-y-1">
          <Link
            to="/about"
            onClick={() => isMobile && setSidebarOpen(false)}
            className={`flex items-center px-3 py-2 rounded-md transition-all ${
              location.pathname === "/about"
                ? "bg-primary text-primary-foreground"
                : "text-sidebar-foreground hover:bg-primary/90 hover:text-primary-foreground"
            } ${!sidebarOpen && !isMobile ? 'justify-center' : 'gap-3'}`}
          >
            <Info className="h-4 w-4 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 overflow-hidden ${
              sidebarOpen || isMobile ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
            }`}>
              {t("navigation.about")}
            </span>
          </Link>
          <button
            onClick={() => {
              handleLogout();
              isMobile && setSidebarOpen(false);
            }}
            className={`flex items-center px-3 py-2 rounded-md transition-all text-sidebar-foreground hover:bg-primary/90 hover:text-primary-foreground w-full ${!sidebarOpen && !isMobile ? 'justify-center' : 'gap-3'}`}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span className={`whitespace-nowrap transition-all duration-200 overflow-hidden ${
              sidebarOpen || isMobile ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'
            }`}>
              {t("auth.logout")}
            </span>
          </button>
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
              className="h-8 w-8 md:flex hidden items-center justify-center"
            >
              <Menu className="h-4 w-4" />
            </Button>
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 md:hidden flex items-center justify-center"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <h1 className="text-xl font-semibold">
              {location.pathname === "/dashboard" && t("navigation.dashboard")}
              {location.pathname === "/torrents" && t("navigation.torrents")}
              {location.pathname === "/instances" && "Instances"}
              {location.pathname === "/agents" && t("navigation.agents")}
              {location.pathname === "/categories" && t("navigation.categories")}
              {location.pathname === "/analytics" && t("navigation.analytics")}
              {location.pathname === "/settings" && t("navigation.settings")}
              {location.pathname === "/profile" && t("navigation.profile")}
              {location.pathname === "/about" && t("navigation.about")}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <Button variant="ghost" size="icon" aria-label={t("navigation.settings")} asChild className="h-8 w-8 flex items-center justify-center">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" aria-label={t("theme.toggle")} onClick={toggleTheme} className="h-8 w-8 flex items-center justify-center">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profile" className="hidden sm:flex">
                <Users className="h-4 w-4 mr-2" />
                {t("navigation.profile")}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="hidden sm:flex" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              {t("auth.logout")}
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
