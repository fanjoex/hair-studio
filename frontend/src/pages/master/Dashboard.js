import { useEffect, useState } from "react";
import { masterService } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Store, Users, Briefcase, UserCircle } from "lucide-react";
import { toast } from "sonner";

export function MasterDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await masterService.getStats();
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
      toast.error("Erro ao carregar estatísticas");
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: "Total de Barbearias",
      value: stats?.total_barbershops || 0,
      icon: Store,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Barbearias Ativas",
      value: stats?.active_barbershops || 0,
      icon: Store,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Total de Clientes",
      value: stats?.total_clients || 0,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Total de Serviços",
      value: stats?.total_services || 0,
      icon: Briefcase,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total de Usuários",
      value: stats?.total_users || 0,
      icon: UserCircle,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
    {
      title: "Barbearias Pendentes",
      value: stats?.pending_barbershops || 0,
      icon: Store,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="body-text">Carregando estatísticas...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="heading-1 mb-2">Dashboard</h1>
        <p className="body-text">Visão geral da plataforma</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          
          return (
            <Card
              key={index}
              className="p-6 bg-surface border-border hover:border-primary/20 transition-all duration-200"
              data-testid={`stat-card-${index}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-zinc-400 mb-2">{stat.title}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Overview */}
        <Card className="p-6 bg-surface border-border">
          <h3 className="heading-3 mb-4">Status das Barbearias</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Ativas</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden w-32">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{
                      width: `${
                        stats?.total_barbershops > 0
                          ? (stats.active_barbershops / stats.total_barbershops) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-white font-semibold w-8 text-right">
                  {stats?.active_barbershops || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Pendentes</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden w-32">
                  <div
                    className="h-full bg-yellow-500 rounded-full transition-all"
                    style={{
                      width: `${
                        stats?.total_barbershops > 0
                          ? (stats.pending_barbershops / stats.total_barbershops) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-white font-semibold w-8 text-right">
                  {stats?.pending_barbershops || 0}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Inativas</span>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden w-32">
                  <div
                    className="h-full bg-red-500 rounded-full transition-all"
                    style={{
                      width: `${
                        stats?.total_barbershops > 0
                          ? (stats.inactive_barbershops / stats.total_barbershops) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
                <span className="text-white font-semibold w-8 text-right">
                  {stats?.inactive_barbershops || 0}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Platform Overview */}
        <Card className="p-6 bg-surface border-border">
          <h3 className="heading-3 mb-4">Resumo da Plataforma</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Média de clientes por barbearia</span>
              <span className="text-white font-semibold">
                {stats?.total_barbershops > 0
                  ? Math.round(stats.total_clients / stats.total_barbershops)
                  : 0}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-zinc-800">
              <span className="text-zinc-400">Média de serviços por barbearia</span>
              <span className="text-white font-semibold">
                {stats?.total_barbershops > 0
                  ? Math.round(stats.total_services / stats.total_barbershops)
                  : 0}
              </span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-zinc-400">Taxa de ativação</span>
              <span className="text-white font-semibold">
                {stats?.total_barbershops > 0
                  ? Math.round((stats.active_barbershops / stats.total_barbershops) * 100)
                  : 0}
                %
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
