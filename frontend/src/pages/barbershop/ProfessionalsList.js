import { useEffect, useState } from "react";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const SPECIALTIES = [
  { value: "haircut", label: "Cabelo" },
  { value: "beard", label: "Barba" },
  { value: "combo", label: "Combo" },
  { value: "other", label: "Outro" },
];

export function ProfessionalsList() {
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", specialties: ["haircut", "beard"] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.listProfessionals();
      setProfessionals(data);
    } catch (error) {
      toast.error("Erro ao carregar profissionais");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: "", phone: "", email: "", specialties: ["haircut", "beard"] });
    setShowForm(true);
  };

  const openEdit = (pro) => {
    setEditing(pro);
    setFormData({ name: pro.name, phone: pro.phone, email: pro.email || "", specialties: pro.specialties || [] });
    setShowForm(true);
  };

  const toggleSpecialty = (val) => {
    setFormData((prev) => ({
      ...prev,
      specialties: prev.specialties.includes(val)
        ? prev.specialties.filter((s) => s !== val)
        : [...prev.specialties, val],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...formData };
      if (!payload.email) delete payload.email;
      if (editing) {
        await barbershopService.updateProfessional(editing.id, payload);
        toast.success("Profissional atualizado!");
      } else {
        await barbershopService.createProfessional(payload);
        toast.success("Profissional criado!");
      }
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await barbershopService.deleteProfessional(deleteId);
      toast.success("Profissional removido!");
      setDeleteId(null);
      load();
    } catch (error) {
      toast.error("Erro ao remover");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="professionals-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="heading-1 mb-2">Profissionais</h1>
          <p className="body-text">{professionals.length} profissionais cadastrados</p>
        </div>
        <Button onClick={openCreate} data-testid="add-professional-button">
          <Plus className="w-4 h-4 mr-2" />
          Novo Profissional
        </Button>
      </div>

      {professionals.length === 0 ? (
        <Card className="p-12 bg-surface border-border text-center">
          <div className="max-w-md mx-auto">
            <h3 className="heading-3 mb-2">Nenhum profissional cadastrado</h3>
            <p className="body-text mb-6">Cadastre seus barbeiros para começar a agendar</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Cadastrar Profissional</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {professionals.map((pro) => (
            <Card key={pro.id} className={`p-5 bg-surface border-border hover:border-primary/20 transition-all ${!pro.active ? "opacity-60" : ""}`} data-testid={`professional-card-${pro.id}`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{pro.name}</h3>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(pro)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(pro.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-zinc-400"><Phone className="w-3.5 h-3.5" /><span>{pro.phone}</span></div>
                {pro.email && <div className="flex items-center gap-2 text-sm text-zinc-400"><Mail className="w-3.5 h-3.5" /><span>{pro.email}</span></div>}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {pro.specialties?.map((s) => {
                  const spec = SPECIALTIES.find((sp) => sp.value === s);
                  return <Badge key={s} className="bg-primary/10 text-primary border-primary/20 border text-xs">{spec?.label || s}</Badge>;
                })}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? "Editar Profissional" : "Novo Profissional"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Nome *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="mt-1 bg-background border-border text-white" data-testid="professional-name-input" />
            </div>
            <div>
              <Label className="text-zinc-300">Telefone *</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} required className="mt-1 bg-background border-border text-white" placeholder="(00) 00000-0000" data-testid="professional-phone-input" />
            </div>
            <div>
              <Label className="text-zinc-300">Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="mt-1 bg-background border-border text-white" data-testid="professional-email-input" />
            </div>
            <div>
              <Label className="text-zinc-300">Especialidades</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SPECIALTIES.map((s) => (
                  <button key={s.value} type="button" onClick={() => toggleSpecialty(s.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${formData.specialties.includes(s.value) ? "bg-primary/20 text-primary border-primary/30" : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500"}`}
                  >{s.label}</button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1" data-testid="save-professional-button">{saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover Profissional</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
