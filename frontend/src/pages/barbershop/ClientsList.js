import { useEffect, useState } from "react";
import axios from "axios";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Phone, Mail, Search, FileText, History, DollarSign, Calendar, User, Clock, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API = (window.__BACKEND_URL__ || window.location.origin) + "/api";

const PAY_STATUS = {
  pending: { label: "Aguardando", color: "text-amber-400" },
  paid: { label: "Pago", color: "text-green-400" },
  cancelled: { label: "Cancelado", color: "text-red-400" },
};

const STATUS_LABELS = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
  no_show: "Não compareceu",
};

const STATUS_COLORS = {
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  no_show: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
};

export function ClientsList() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState("appointments");
  const [paymentHistory, setPaymentHistory] = useState(null);

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.listClients();
      setClients(data);
    } catch (error) {
      toast.error("Erro ao carregar clientes");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingClient(null);
    setFormData({ name: "", phone: "", email: "", notes: "" });
    setShowForm(true);
  };

  const openEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      email: client.email || "",
      notes: client.notes || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.email) delete payload.email;
      if (!payload.notes) delete payload.notes;

      if (editingClient) {
        await barbershopService.updateClient(editingClient.id, payload);
        toast.success("Cliente atualizado!");
      } else {
        await barbershopService.createClient(payload);
        toast.success("Cliente criado!");
      }
      setShowForm(false);
      loadClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar cliente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await barbershopService.deleteClient(deleteId);
      toast.success("Cliente removido!");
      setDeleteId(null);
      loadClients();
    } catch (error) {
      toast.error("Erro ao remover cliente");
    }
  };

  const openHistory = async (client) => {
    setHistoryLoading(true);
    setHistoryData(null);
    setPaymentHistory(null);
    setHistoryTab("appointments");
    try {
      const [apptData, payData] = await Promise.all([
        barbershopService.getClientHistory(client.id),
        axios.get(`${API}/payment/client/${client.id}/history`, { withCredentials: true }).then(r => r.data).catch(() => ({ charges: [], total_paid: 0 })),
      ]);
      setHistoryData(apptData);
      setPaymentHistory(payData);
    } catch (error) {
      toast.error("Erro ao carregar histórico");
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="clients-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="heading-1 mb-2">Clientes</h1>
          <p className="body-text">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openCreate} data-testid="add-client-button">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {clients.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-surface border-border text-white"
            data-testid="search-clients-input"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-12 bg-surface border-border text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="heading-3 mb-2">
              {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </h3>
            <p className="body-text mb-6">
              {search ? "Tente outro termo de busca" : "Cadastre seu primeiro cliente"}
            </p>
            {!search && (
              <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Cadastrar Cliente</Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <Card
              key={client.id}
              className="p-5 bg-surface border-border hover:border-primary/20 transition-all"
              data-testid={`client-card-${client.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{client.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openHistory(client)} title="Histórico" data-testid={`history-client-${client.id}`}>
                    <History className="w-4 h-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(client)} data-testid={`edit-client-${client.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(client.id)} className="text-red-500 hover:text-red-400" data-testid={`delete-client-${client.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{client.phone}</span>
                </div>
                {client.email && (
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{client.email}</span>
                  </div>
                )}
                {client.notes && (
                  <div className="flex items-start gap-2 text-sm text-zinc-500">
                    <FileText className="w-3.5 h-3.5 mt-0.5" />
                    <span className="line-clamp-2">{client.notes}</span>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Client History Dialog */}
      <Dialog open={!!historyData || historyLoading} onOpenChange={() => { setHistoryData(null); setHistoryLoading(false); setPaymentHistory(null); }}>
        <DialogContent className="bg-surface border-border max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="client-history-dialog">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Atendimentos
            </DialogTitle>
          </DialogHeader>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : historyData ? (
            <div className="space-y-4">
              {/* Client Summary */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Card className="flex-1 p-3 bg-background border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold" data-testid="history-client-name">{historyData.client.name}</p>
                      <p className="text-xs text-zinc-500">{historyData.client.phone}</p>
                    </div>
                  </div>
                </Card>
                <Card className="flex-1 p-3 bg-background border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <DollarSign className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold" data-testid="history-total-spent">R$ {historyData.total_spent.toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">Agendamentos</p>
                    </div>
                  </div>
                </Card>
                <Card className="flex-1 p-3 bg-background border-border">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">R$ {(paymentHistory?.total_paid || 0).toFixed(2)}</p>
                      <p className="text-xs text-zinc-500">Pago via Pix</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border">
                {[
                  { key: "appointments", label: "Agendamentos", count: historyData.appointments.length },
                  { key: "payments", label: "Pagamentos", count: paymentHistory?.charges?.length || 0 },
                ].map(t => (
                  <button key={t.key} onClick={() => setHistoryTab(t.key)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${historyTab === t.key ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-white"}`}>
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {/* Appointments Tab */}
              {historyTab === "appointments" && (
                historyData.appointments.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">Nenhum agendamento encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyData.appointments.map((apt) => (
                      <Card key={apt.id} className="p-4 bg-background border-border" data-testid={`history-apt-${apt.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <p className="text-white font-medium">{apt.service_name || "Serviço"}</p>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{apt.date}</span>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{apt.start_time}</span>
                              {apt.professional_name && <span className="flex items-center gap-1"><User className="w-3 h-3" />{apt.professional_name}</span>}
                              {apt.duration_minutes > 0 && <span>{apt.duration_minutes}min</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-white font-semibold">R$ {(apt.price || 0).toFixed(2)}</p>
                            <Badge className={`text-[10px] border mt-1 ${STATUS_COLORS[apt.status] || STATUS_COLORS.scheduled}`}>
                              {STATUS_LABELS[apt.status] || apt.status}
                            </Badge>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}

              {/* Payments Tab */}
              {historyTab === "payments" && (
                !paymentHistory?.charges?.length ? (
                  <div className="text-center py-8">
                    <CreditCard className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                    <p className="text-zinc-500">Nenhum pagamento registrado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentHistory.charges.map((c) => (
                      <Card key={c.id} className="p-4 bg-background border-border">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-white text-sm font-medium">{c.description}</p>
                            <p className="text-xs text-zinc-500">{new Date(c.created_at).toLocaleDateString("pt-BR")} · {c.gateway}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-primary font-bold">R$ {c.total?.toFixed(2)}</p>
                            <p className={`text-xs ${PAY_STATUS[c.status]?.color}`}>{PAY_STATUS[c.status]?.label}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingClient ? "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Nome *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="mt-1 bg-background border-border text-white"
                data-testid="client-name-input"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Telefone *</Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
                className="mt-1 bg-background border-border text-white"
                placeholder="(00) 00000-0000"
                data-testid="client-phone-input"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 bg-background border-border text-white"
                data-testid="client-email-input"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Observações</Label>
              <Input
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 bg-background border-border text-white"
                placeholder="Preferências, alergias..."
                data-testid="client-notes-input"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1" data-testid="save-client-button">
                {saving ? "Salvando..." : editingClient ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover Cliente</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
