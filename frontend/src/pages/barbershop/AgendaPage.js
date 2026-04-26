import { useEffect, useState } from "react";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus, Clock, User, Briefcase, Check, X as XIcon, AlertTriangle, MessageCircle, Send, Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getClientConfirmationLink,
  getClientReminderLink,
  getProfessionalConfirmationLink,
  getProfessionalDayReminderLink,
} from "@/utils/whatsapp";

const STATUS_MAP = {
  scheduled: { label: "Agendado", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  completed: { label: "Concluído", color: "bg-green-500/10 text-green-500 border-green-500/20" },
  cancelled: { label: "Cancelado", color: "bg-red-500/10 text-red-500 border-red-500/20" },
  no_show: { label: "Não Compareceu", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
};

function getToday() {
  return new Date().toISOString().split("T")[0];
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export function AgendaPage() {
  const [date, setDate] = useState(getToday());
  const [appointments, setAppointments] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [allProfessionals, setAllProfessionals] = useState([]);
  const [clients, setClients] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(null);
  const [barbershopName, setBarbershopName] = useState("");
  const [formData, setFormData] = useState({ professional_id: "", client_name: "", client_phone: "", service_id: "", date: "", start_time: "09:00", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadAppointments(); }, [date]);

  const loadAll = async () => {
    try {
      const [pros, cls, svcs, dashboard] = await Promise.all([
        barbershopService.listProfessionals(),
        barbershopService.listClients(),
        barbershopService.listServices(),
        barbershopService.getDashboard(),
      ]);
      setAllProfessionals(pros);
      setProfessionals(pros.filter((p) => p.active));
      setClients(cls);
      setServices(svcs.filter((s) => s.active));
      setBarbershopName(dashboard.barbershop_name || "Barbearia");
    } catch (e) {
      console.error(e);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.listAppointments(date);
      setAppointments(data);
    } catch (e) {
      toast.error("Erro ao carregar agenda");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormData({ professional_id: professionals[0]?.id || "", client_name: "", client_phone: "", service_id: services[0]?.id || "", date, start_time: "09:00", notes: "" });
    setShowForm(true);
  };

  const selectClient = (client) => {
    setFormData((prev) => ({ ...prev, client_name: client.name, client_phone: client.phone }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await barbershopService.createAppointment(formData);
      toast.success("Agendamento criado!");
      setShowForm(false);
      setShowConfirmation(result);
      loadAppointments();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao agendar");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await barbershopService.updateAppointmentStatus(id, status);
      toast.success("Status atualizado!");
      loadAppointments();
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  };

  const getProfessionalPhone = (proId) => {
    const pro = allProfessionals.find((p) => p.id === proId);
    return pro?.phone || "";
  };

  const grouped = {};
  appointments.forEach((a) => {
    if (!grouped[a.professional_name]) grouped[a.professional_name] = [];
    grouped[a.professional_name].push(a);
  });

  return (
    <div data-testid="agenda-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="heading-1 mb-2">Agenda</h1>
          <p className="body-text">Gerencie os agendamentos da barbearia</p>
        </div>
        <Button onClick={openCreate} disabled={professionals.length === 0 || services.length === 0} data-testid="new-appointment-button">
          <Plus className="w-4 h-4 mr-2" />
          Novo Agendamento
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="outline" size="sm" onClick={() => setDate(shiftDate(date, -1))} data-testid="prev-day-button">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="text-center min-w-[250px]">
          <p className="text-lg font-semibold text-white" data-testid="current-date-label">{formatDateLabel(date)}</p>
          {date !== getToday() && (
            <button onClick={() => setDate(getToday())} className="text-xs text-primary hover:underline">Hoje</button>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setDate(shiftDate(date, 1))} data-testid="next-day-button">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto bg-surface border-border text-white" data-testid="date-picker" />
      </div>

      {professionals.length === 0 && (
        <Card className="p-8 bg-surface border-border text-center mb-6">
          <p className="body-text">Cadastre profissionais antes de criar agendamentos.</p>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : appointments.length === 0 ? (
        <Card className="p-12 bg-surface border-border text-center">
          <h3 className="heading-3 mb-2">Nenhum agendamento</h3>
          <p className="body-text">Nenhum agendamento para {formatDateLabel(date)}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([proName, apts]) => (
            <div key={proName}>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {proName}
                <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 border ml-2">{apts.length} agendamento{apts.length > 1 ? "s" : ""}</Badge>
              </h3>
              <div className="space-y-3">
                {apts.map((apt) => {
                  const st = STATUS_MAP[apt.status] || STATUS_MAP.scheduled;
                  return (
                    <Card key={apt.id} className="p-4 bg-surface border-border hover:border-primary/10 transition-all" data-testid={`appointment-card-${apt.id}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-4">
                          <div className="text-center min-w-[80px]">
                            <p className="text-xl font-bold text-white">{apt.start_time}</p>
                            <p className="text-xs text-zinc-500">{apt.end_time}</p>
                          </div>
                          <div className="border-l border-zinc-700 pl-4">
                            <p className="font-semibold text-white">{apt.client_name}</p>
                            <p className="text-sm text-zinc-400 flex items-center gap-1"><Briefcase className="w-3 h-3" />{apt.service_name} - R$ {apt.price.toFixed(2)}</p>
                            <p className="text-sm text-zinc-500 flex items-center gap-1"><Clock className="w-3 h-3" />{apt.duration_minutes} min</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`${st.color} border`}>{st.label}</Badge>
                          {/* WhatsApp buttons */}
                          <a
                            href={getClientReminderLink(apt, barbershopName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-600/10 text-green-500 border border-green-600/20 hover:bg-green-600/20 transition-colors"
                            data-testid={`whatsapp-client-${apt.id}`}
                          >
                            <MessageCircle className="w-3 h-3" />Cliente
                          </a>
                          {getProfessionalPhone(apt.professional_id) && (
                            <a
                              href={getProfessionalConfirmationLink(getProfessionalPhone(apt.professional_id), apt, barbershopName)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-600/10 text-green-500 border border-green-600/20 hover:bg-green-600/20 transition-colors"
                              data-testid={`whatsapp-pro-${apt.id}`}
                            >
                              <MessageCircle className="w-3 h-3" />Profissional
                            </a>
                          )}
                          {apt.status === "scheduled" && (
                            <>
                              <Button size="sm" variant="outline" className="text-green-500 border-green-500/20 hover:bg-green-500/10" onClick={() => updateStatus(apt.id, "completed")} data-testid={`complete-apt-${apt.id}`}>
                                <Check className="w-3.5 h-3.5 mr-1" />Concluir
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-500 border-red-500/20 hover:bg-red-500/10" onClick={() => updateStatus(apt.id, "cancelled")} data-testid={`cancel-apt-${apt.id}`}>
                                <XIcon className="w-3.5 h-3.5 mr-1" />Cancelar
                              </Button>
                              <Button size="sm" variant="outline" className="text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/10" onClick={() => updateStatus(apt.id, "no_show")} data-testid={`noshow-apt-${apt.id}`}>
                                <AlertTriangle className="w-3.5 h-3.5 mr-1" />Faltou
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reminder Section - Send reminders for all scheduled appointments */}
      {!loading && appointments.filter((a) => a.status === "scheduled").length > 0 && (
        <Card className="p-4 bg-surface border-border mt-6" data-testid="reminders-section">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white">Enviar Lembretes</h3>
          </div>
          <p className="text-sm text-zinc-400 mb-3">Envie lembretes via WhatsApp para os agendamentos de {formatDateLabel(date)}</p>
          <div className="flex flex-wrap gap-2">
            {/* Individual client reminders */}
            {appointments.filter((a) => a.status === "scheduled").map((apt) => (
              <a
                key={`rem-${apt.id}`}
                href={getClientReminderLink(apt, barbershopName)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-green-600/10 text-green-500 border border-green-600/20 hover:bg-green-600/20 transition-colors"
                data-testid={`reminder-client-${apt.id}`}
              >
                <Send className="w-3.5 h-3.5" />
                {apt.client_name} ({apt.start_time})
              </a>
            ))}
            {/* Professional day summary reminders */}
            {Object.entries(grouped).map(([proName, apts]) => {
              const scheduledApts = apts.filter((a) => a.status === "scheduled");
              if (scheduledApts.length === 0) return null;
              const proPhone = getProfessionalPhone(scheduledApts[0].professional_id);
              if (!proPhone) return null;
              return (
                <a
                  key={`rem-pro-${proName}`}
                  href={getProfessionalDayReminderLink(proPhone, scheduledApts, barbershopName, date)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20 transition-colors"
                  data-testid={`reminder-pro-${proName}`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Agenda {proName} ({scheduledApts.length} agend.)
                </a>
              );
            })}
          </div>
        </Card>
      )}

      {/* New Appointment Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-surface border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Novo Agendamento</DialogTitle>
            <p className="text-sm text-zinc-400">Preencha os dados para criar um novo agendamento</p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Profissional *</Label>
              <select value={formData.professional_id} onChange={(e) => setFormData({ ...formData, professional_id: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-border bg-background text-white px-3" required data-testid="apt-professional-select">
                <option value="">Selecione...</option>
                {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Serviço *</Label>
              <select value={formData.service_id} onChange={(e) => setFormData({ ...formData, service_id: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-border bg-background text-white px-3" required data-testid="apt-service-select">
                <option value="">Selecione...</option>
                {services.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.duration_minutes}min - R${s.price.toFixed(2)})</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Cliente *</Label>
              {clients.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1 mb-2">
                  {clients.slice(0, 5).map((c) => (
                    <button key={c.id} type="button" onClick={() => selectClient(c)} className={`text-xs px-2 py-1 rounded-full border transition-colors ${formData.client_name === c.name ? "bg-primary/20 text-primary border-primary/30" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"}`}>{c.name}</button>
                  ))}
                </div>
              )}
              <Input value={formData.client_name} onChange={(e) => setFormData({ ...formData, client_name: e.target.value })} required className="bg-background border-border text-white" placeholder="Nome do cliente" data-testid="apt-client-name" />
            </div>
            <div>
              <Label className="text-zinc-300">Telefone do Cliente *</Label>
              <Input value={formData.client_phone} onChange={(e) => setFormData({ ...formData, client_phone: e.target.value })} required className="mt-1 bg-background border-border text-white" placeholder="(00) 00000-0000" data-testid="apt-client-phone" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Data *</Label>
                <Input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required className="mt-1 bg-background border-border text-white" data-testid="apt-date-input" />
              </div>
              <div>
                <Label className="text-zinc-300">Horário *</Label>
                <Input type="time" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} required className="mt-1 bg-background border-border text-white" data-testid="apt-time-input" />
              </div>
            </div>
            <div>
              <Label className="text-zinc-300">Observações</Label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="mt-1 bg-background border-border text-white" placeholder="Observações..." data-testid="apt-notes-input" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1" data-testid="save-appointment-button">{saving ? "Agendando..." : "Agendar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog with WhatsApp Links */}
      <Dialog open={!!showConfirmation} onOpenChange={() => setShowConfirmation(null)}>
        <DialogContent className="bg-surface border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Agendamento Criado!</DialogTitle>
            <p className="text-sm text-zinc-400">Envie a confirmação via WhatsApp</p>
          </DialogHeader>
          {showConfirmation && (
            <div className="space-y-4">
              <Card className="p-4 bg-background border-border">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-zinc-400">Cliente:</span><span className="text-white font-semibold">{showConfirmation.client_name}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Serviço:</span><span className="text-white">{showConfirmation.service_name}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Profissional:</span><span className="text-white">{showConfirmation.professional_name}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Data/Hora:</span><span className="text-white">{showConfirmation.date} às {showConfirmation.start_time}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="text-primary font-semibold">R$ {showConfirmation.price.toFixed(2)}</span></div>
                </div>
              </Card>
              <div className="space-y-2">
                <a
                  href={getClientConfirmationLink(showConfirmation, barbershopName)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                  data-testid="whatsapp-confirm-client"
                >
                  <MessageCircle className="w-5 h-5" />
                  Enviar Confirmação ao Cliente
                </a>
                {getProfessionalPhone(showConfirmation.professional_id) && (
                  <a
                    href={getProfessionalConfirmationLink(getProfessionalPhone(showConfirmation.professional_id), showConfirmation, barbershopName)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-green-600/20 text-green-500 font-semibold border border-green-600/30 hover:bg-green-600/30 transition-colors"
                    data-testid="whatsapp-confirm-professional"
                  >
                    <MessageCircle className="w-5 h-5" />
                    Notificar Profissional
                  </a>
                )}
              </div>
              <Button variant="outline" className="w-full" onClick={() => setShowConfirmation(null)}>Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
