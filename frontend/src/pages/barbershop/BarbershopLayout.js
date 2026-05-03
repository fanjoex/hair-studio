import { Outlet, Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Users, Briefcase, Calendar, UserCheck, Settings, LogOut, Menu, X, Scissors, Megaphone } from "lucide-react";
import { useState } from "react";

export function BarbershopLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menuItems = [
    { path: "/barbershop", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/barbershop/agenda", icon: Calendar, label: "Agenda" },
    { path: "/barbershop/clients", icon: Users, label: "Clientes" },
    { path: "/barbershop/services", icon: Briefcase, label: "Serviços" },
    { path: "/barbershop/professionals", icon: UserCheck, label: "Profissionais" },
    { path: "/barbershop/styles", icon: Scissors, label: "Estilos IA" },
    { path: "/barbershop/advertisements", icon: Megaphone, label: "Propagandas" },
    { path: "/barbershop/settings", icon: Settings, label: "Configurações" },
  ];

  const isActive = (path) => {
    if (path === "/barbershop") return location.pathname === "/barbershop";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background" data-testid="barbershop-layout">
      {/* Header Mobile */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary">Minha Barbearia</h1>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
          data-testid="mobile-menu-toggle"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      <div className="flex pt-16 lg:pt-0">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:sticky top-16 lg:top-0 left-0 h-[calc(100vh-4rem)] lg:h-screen
            w-64 bg-surface border-r border-border
            transition-transform duration-300 z-40
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          `}
        >
          <div className="flex flex-col h-full">
            <div className="hidden lg:block p-6 border-b border-border">
              <h1 className="text-2xl font-bold text-primary">Minha Barbearia</h1>
              <p className="text-sm text-zinc-400 mt-1">Gerenciamento</p>
            </div>

            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">
                    {user?.name?.charAt(0)?.toUpperCase() || "B"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                  <p className="text-xs text-zinc-400 truncate">Dono da Barbearia</p>
                </div>
              </div>
            </div>

            <nav className="flex-1 p-4 overflow-y-auto">
              <ul className="space-y-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <li key={item.path}>
                      <Link
                        to={item.path}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                          ${active
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-zinc-400 hover:bg-surface-hover hover:text-white"
                          }
                        `}
                        data-testid={`nav-${item.label.toLowerCase()}`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            <div className="p-4 border-t border-border">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="w-full justify-start"
                data-testid="barbershop-logout-button"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="flex-1 min-h-screen">
          <div className="container mx-auto p-6 lg:p-8 max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
