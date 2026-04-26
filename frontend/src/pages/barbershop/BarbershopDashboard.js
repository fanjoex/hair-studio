import { useEffect, useState } from "react";
import { barbershopService } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Briefcase, CheckCircle, XCircle, DollarSign, TrendingUp, Calendar, BarChart3, Clock, UserX } from "lucide-react";
import { toast } from "sonner";

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

export function BarbershopDashboard() {
  const [stats, setStats] = useState(null);
  const [report, setReport] = useState(null);
  const [period, setPeriod] = useState("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadReport(); }, [period]);

  const loadStats = async () => {
    try {
      const data = await barbershopService.getDashboard();
      setStats(data);
    } catch (error) {
      toast.error("Erro ao carregar dashboard");
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    try {
      const data = await barbershopService.getFinancialReport(period);
      setReport(data);
    } catch (error) {
      console.error("Error loading report:", error);
    }
  };

  const maxRevenue = report?.daily_revenue?.length > 0
    ? Math.max(...report.daily_revenue.map((d) => d.revenue))
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
      </div>
    );
  }

  return (
    <div data-testid="barbershop-dashboard">
      <div className="mb-8">
        <h1 className="heading-1 mb-2">{stats?.barbershop_name || "Dashboard"}</h1>
        <p className="body-text">Visão geral e relatórios financeiros</p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { title: "Clientes", value: stats?.total_clients || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
          { title: "Serviços", value: stats?.total_services || 0, icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
          { title: "Ativos", value: stats?.active_services || 0, icon: CheckCircle, color: "text-green-500", bg: "bg-green-500/10" },
          { title: "Inativos", value: stats?.inactive_services || 0, icon: XCircle, color: "text-red-500", bg: "bg-red-500/10" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="p-4 bg-surface border-border" data-testid={`stat-card-${i}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-zinc-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2 mb-6">
        <BarChart3 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-white">Relatório Financeiro</h2>
        <div className="flex gap-1 ml-4">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              variant="outline"
              size="sm"
              onClick={() => setPeriod(p.value)}
              className={period === p.value ? "bg-primary text-black border-primary" : ""}
              data-testid={`period-${p.value}`}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {report && (
        <>
          {/* Financial Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 bg-surface border-border border-l-4 border-l-green-500" data-testid="revenue-card">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="w-4 h-4 text-green-500" />
                <p className="text-xs text-zinc-400">Receita</p>
              </div>
              <p className="text-2xl font-bold text-green-500">R$ {report.revenue.toFixed(2)}</p>
            </Card>
            <Card className="p-4 bg-surface border-border border-l-4 border-l-primary" data-testid="avg-ticket-card">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-primary" />
                <p className="text-xs text-zinc-400">Ticket Médio</p>
              </div>
              <p className="text-2xl font-bold text-primary">R$ {report.avg_ticket.toFixed(2)}</p>
            </Card>
            <Card className="p-4 bg-surface border-border border-l-4 border-l-blue-500" data-testid="appointments-card">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-blue-500" />
                <p className="text-xs text-zinc-400">Agendamentos</p>
              </div>
              <p className="text-2xl font-bold text-blue-500">{report.total_appointments}</p>
            </Card>
            <Card className="p-4 bg-surface border-border border-l-4 border-l-amber-500" data-testid="completion-card">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-zinc-400">Taxa Conclusão</p>
              </div>
              <p className="text-2xl font-bold text-amber-500">{report.completion_rate}%</p>
            </Card>
          </div>

          {/* Status breakdown */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-xs text-zinc-500">Concluídos</p>
                <p className="text-lg font-bold text-green-500">{report.completed}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10">
              <Clock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-zinc-500">Agendados</p>
                <p className="text-lg font-bold text-blue-500">{report.scheduled}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
              <XCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-xs text-zinc-500">Cancelados</p>
                <p className="text-lg font-bold text-red-500">{report.cancelled}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10">
              <UserX className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-xs text-zinc-500">Faltas</p>
                <p className="text-lg font-bold text-yellow-500">{report.no_show}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Revenue Chart (simple bars) */}
            {report.daily_revenue.length > 0 && (
              <Card className="p-5 bg-surface border-border" data-testid="revenue-chart">
                <h3 className="text-sm font-semibold text-white mb-4">Receita por Dia</h3>
                <div className="space-y-2">
                  {report.daily_revenue.map((day) => {
                    const pct = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                    const dateLabel = day.date.slice(5); // MM-DD
                    return (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500 w-12 shrink-0">{dateLabel}</span>
                        <div className="flex-1 h-6 bg-zinc-800 rounded-md overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-md transition-all duration-500"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-green-500 font-semibold w-20 text-right">R$ {day.revenue.toFixed(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Rankings */}
            <div className="space-y-6">
              {/* Top Services */}
              {report.top_services.length > 0 && (
                <Card className="p-5 bg-surface border-border" data-testid="top-services">
                  <h3 className="text-sm font-semibold text-white mb-4">Serviços Mais Populares</h3>
                  <div className="space-y-3">
                    {report.top_services.map((svc, i) => (
                      <div key={svc.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 w-5">{i + 1}.</span>
                          <span className="text-sm text-white">{svc.name}</span>
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 border text-xs">{svc.count}x</Badge>
                        </div>
                        <span className="text-sm font-semibold text-green-500">R$ {svc.revenue.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Top Professionals */}
              {report.top_professionals.length > 0 && (
                <Card className="p-5 bg-surface border-border" data-testid="top-professionals">
                  <h3 className="text-sm font-semibold text-white mb-4">Ranking de Profissionais</h3>
                  <div className="space-y-3">
                    {report.top_professionals.map((pro, i) => (
                      <div key={pro.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-zinc-500 w-5">{i + 1}.</span>
                          <span className="text-sm text-white">{pro.name}</span>
                          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 border text-xs">{pro.count} atend.</Badge>
                        </div>
                        <span className="text-sm font-semibold text-green-500">R$ {pro.revenue.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Empty state */}
          {report.total_appointments === 0 && (
            <Card className="p-8 bg-surface border-border text-center">
              <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Sem dados para este período</h3>
              <p className="body-text">Agendamentos concluídos aparecerão aqui como receita.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
