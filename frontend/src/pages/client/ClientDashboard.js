import { useEffect, useState } from "react";
import { clientService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Sparkles, LogOut, Scissors, Clock } from "lucide-react";
import { toast } from "sonner";

const STATUS_LABEL = {
  scheduled: { label: "Agendado", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  confirmed: { label: "Confirmado", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  completed: { label: "Concluído", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  no_show: { label: "Não compareceu", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return dateStr;
  }
}

export function ClientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("appointments");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [p, h, a] = await Promise.all([
        clientService.getProfile().catch(() => null),
        clientService.getAiHistory().catch(() => []),
        clientService.getAppointments().catch(() => []),
      ]);
      setProfile(p);
      setHistory(h || []);
      setAppointments(a || []);
    } catch (e) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const upcoming = appointments.filter((a) => ["scheduled", "confirmed"].includes(a.status));
  const past = appointments.filter((a) => !["scheduled", "confirmed"].includes(a.status));

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gold">Olá, {user?.name?.split(" ")[0]}</h1>
          {profile?.barbershop_name && (
            <p className="text-xs text-zinc-400 mt-0.5">{profile.barbershop_name}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} data-testid="client-logout">
          <LogOut className="w-4 h-4 mr-1" />
          Sair
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {profile?.barbershop_id && (
            <>
              <Button
                onClick={() => navigate(`/agendar/${profile.barbershop_id}`)}
                className="btn-gold h-auto py-4 flex-col gap-1"
                data-testid="client-book-button"
              >
                <Calendar className="w-5 h-5" />
                <span>Agendar</span>
              </Button>
              <Button
                onClick={() => navigate(`/experimentar/${profile.barbershop_id}`)}
                variant="outline"
                className="h-auto py-4 flex-col gap-1"
                data-testid="client-try-ai-button"
              >
                <Sparkles className="w-5 h-5" />
                <span>Experimentar IA</span>
              </Button>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-border">
          <button
            onClick={() => setTab("appointments")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === "appointments" ? "text-primary border-b-2 border-primary" : "text-zinc-400 hover:text-white"}`}
            data-testid="tab-appointments"
          >
            <Calendar className="w-4 h-4 inline mr-1" />
            Agendamentos
          </button>
          <button
            onClick={() => setTab("ai")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${tab === "ai" ? "text-primary border-b-2 border-primary" : "text-zinc-400 hover:text-white"}`}
            data-testid="tab-ai-history"
          >
            <Sparkles className="w-4 h-4 inline mr-1" />
            Histórico de IA
          </button>
        </div>

        {/* Appointments */}
        {tab === "appointments" && (
          <div className="space-y-6">
            {upcoming.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">Próximos</h3>
                <div className="space-y-2">
                  {upcoming.map((a) => (
                    <Card key={a.id} className="p-4 bg-surface border-border">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-primary" />
                            <span className="font-medium text-white">{formatDate(a.date)}</span>
                          </div>
                          {a.service_name && (
                            <p className="text-sm text-zinc-300">{a.service_name}</p>
                          )}
                          {a.barbershop_name && (
                            <p className="text-xs text-zinc-500 mt-0.5">{a.barbershop_name}</p>
                          )}
                        </div>
                        <Badge className={`${STATUS_LABEL[a.status]?.color} border text-xs`}>
                          {STATUS_LABEL[a.status]?.label || a.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {past.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">Histórico</h3>
                <div className="space-y-2">
                  {past.map((a) => (
                    <Card key={a.id} className="p-4 bg-surface border-border opacity-75">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-zinc-500" />
                            <span className="font-medium text-zinc-300">{formatDate(a.date)}</span>
                          </div>
                          {a.service_name && (
                            <p className="text-sm text-zinc-400">{a.service_name}</p>
                          )}
                          {a.barbershop_name && (
                            <p className="text-xs text-zinc-500 mt-0.5">{a.barbershop_name}</p>
                          )}
                        </div>
                        <Badge className={`${STATUS_LABEL[a.status]?.color} border text-xs`}>
                          {STATUS_LABEL[a.status]?.label || a.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {appointments.length === 0 && (
              <Card className="p-8 bg-surface border-border text-center">
                <Calendar className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 mb-4">Você ainda não tem agendamentos.</p>
                {profile?.barbershop_id && (
                  <Button onClick={() => navigate(`/agendar/${profile.barbershop_id}`)} className="btn-gold">
                    Agendar agora
                  </Button>
                )}
              </Card>
            )}
          </div>
        )}

        {/* AI History */}
        {tab === "ai" && (
          <div>
            {history.length === 0 ? (
              <Card className="p-8 bg-surface border-border text-center">
                <Sparkles className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                <p className="text-zinc-400 mb-4">Você ainda não experimentou nenhum estilo.</p>
                {profile?.barbershop_id && (
                  <Button onClick={() => navigate(`/experimentar/${profile.barbershop_id}`)} className="btn-gold">
                    Experimentar agora
                  </Button>
                )}
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {history.map((h) => (
                  <Card key={h.id} className="bg-surface border-border overflow-hidden" data-testid={`ai-history-${h.id}`}>
                    <div className="grid grid-cols-2">
                      <div className="relative">
                        <img src={`data:image/jpeg;base64,${h.original_image}`} alt="Antes" className="w-full aspect-square object-cover" />
                        <span className="absolute top-1 left-1 text-[10px] bg-black/70 text-white px-2 py-0.5 rounded">Antes</span>
                      </div>
                      <div className="relative">
                        <img src={`data:image/png;base64,${h.generated_image}`} alt="Depois" className="w-full aspect-square object-cover" />
                        <span className="absolute top-1 right-1 text-[10px] bg-primary/80 text-black px-2 py-0.5 rounded font-semibold">Depois</span>
                      </div>
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white text-sm flex items-center gap-1">
                          <Scissors className="w-3 h-3 text-primary" />
                          {h.style_name}
                        </p>
                        <p className="text-xs text-zinc-500">{formatDate(h.created_at)}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = `data:image/png;base64,${h.generated_image}`;
                          link.download = `${h.style_name}.png`;
                          link.click();
                        }}
                      >
                        Baixar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
