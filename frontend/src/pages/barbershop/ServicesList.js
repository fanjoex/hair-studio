import { useEffect, useState } from "react";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Clock, DollarSign, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CATEGORIES = [
  { value: "haircut", label: "Cabelo" },
  { value: "beard", label: "Barba" },
  { value: "combo", label: "Combo" },
  { value: "other", label: "Outro" },
];

export function ServicesList() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({
    name: "", description: "", duration_minutes: 30, price: 0, category: "haircut",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.listServices();
      setServices(data);
    } catch (error) {
      console.error("Error loading services:", error);
      toast.error("Erro ao carregar serviços");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingService(null);
    setFormData({ name: "", description: "", duration_minutes: 30, price: 0, category: "haircut" });
    setShowForm(true);
  };

  const openEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || "",
      duration_minutes: service.duration_minutes,
      price: service.price,
      category: service.category,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData, price: parseFloat(formData.price), duration_minutes: parseInt(formData.duration_minutes) };
      if (!payload.description) delete payload.description;

      if (editingService) {
        await barbershopService.updateService(editingService.id, payload);
        toast.success("Serviço atualizado!");
      } else {
        await barbershopService.createService(payload);
        toast.success("Serviço criado!");
      }
      setShowForm(false);
      loadServices();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar serviço");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (service) => {
    try {
      await barbershopService.updateService(service.id, { active: !service.active });
      toast.success(service.active ? "Serviço desativado" : "Serviço ativado");
      loadServices();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await barbershopService.deleteService(deleteId);
      toast.success("Serviço removido!");
      setDeleteId(null);
      loadServices();
    } catch (error) {
      toast.error("Erro ao remover serviço");
    }
  };

  const getCategoryBadge = (category) => {
    const colors = {
      haircut: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      beard: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      combo: "bg-green-500/10 text-green-500 border-green-500/20",
      other: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    };
    const label = CATEGORIES.find((c) => c.value === category)?.label || category;
    return <Badge className={`${colors[category] || colors.other} border`}>{label}</Badge>;
  };

  const filtered = services.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="services-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="heading-1 mb-2">Serviços</h1>
          <p className="body-text">{services.length} serviços cadastrados</p>
        </div>
        <Button onClick={openCreate} data-testid="add-service-button">
          <Plus className="w-4 h-4 mr-2" />
          Novo Serviço
        </Button>
      </div>

      {services.length > 0 && (
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-surface border-border text-white"
            data-testid="search-services-input"
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
              {search ? "Nenhum serviço encontrado" : "Nenhum serviço cadastrado"}
            </h3>
            <p className="body-text mb-6">
              {search ? "Tente outro termo" : "Cadastre seu primeiro serviço"}
            </p>
            {!search && (
              <Button onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Serviço
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((service) => (
            <Card
              key={service.id}
              className={`p-5 bg-surface border-border hover:border-primary/20 transition-all ${!service.active ? "opacity-60" : ""}`}
              data-testid={`service-card-${service.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                  {service.description && (
                    <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{service.description}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(service)} data-testid={`edit-service-${service.id}`}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(service.id)} className="text-red-500 hover:text-red-400" data-testid={`delete-service-${service.id}`}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                {getCategoryBadge(service.category)}
                <button
                  onClick={() => handleToggleActive(service)}
                  className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                    service.active
                      ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                      : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                  }`}
                  data-testid={`toggle-active-${service.id}`}
                >
                  {service.active ? "Ativo" : "Inativo"}
                </button>
              </div>

              <div className="flex items-center gap-4 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-1.5 text-sm text-zinc-400">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{service.duration_minutes} min</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>R$ {service.price.toFixed(2)}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingService ? "Editar Serviço" : "Novo Serviço"}
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
                placeholder="Ex: Corte Degradê"
                data-testid="service-name-input"
              />
            </div>
            <div>
              <Label className="text-zinc-300">Descrição</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 bg-background border-border text-white"
                placeholder="Descrição do serviço..."
                data-testid="service-description-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-zinc-300">Duração (min) *</Label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  required
                  className="mt-1 bg-background border-border text-white"
                  data-testid="service-duration-input"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Preço (R$) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  required
                  className="mt-1 bg-background border-border text-white"
                  data-testid="service-price-input"
                />
              </div>
            </div>
            <div>
              <Label className="text-zinc-300">Categoria *</Label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="mt-1 w-full h-10 rounded-md border border-border bg-background text-white px-3"
                data-testid="service-category-select"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving} className="flex-1" data-testid="save-service-button">
                {saving ? "Salvando..." : editingService ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover Serviço</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Tem certeza que deseja remover este serviço? Esta ação não pode ser desfeita.
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
