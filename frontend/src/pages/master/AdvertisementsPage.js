import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import { Plus, Pencil, Trash2, X, ShoppingBag, ExternalLink, Eye, EyeOff } from "lucide-react";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

const EMPTY_FORM = { name: "", brand: "", price: "", description: "", affiliate_url: "", image_url: "" };

export function AdvertisementsPage() {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadAds(); }, []);

  const loadAds = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/advertisements/admin/all`, { withCredentials: true });
      setAds(data);
    } catch (e) {
      toast.error("Erro ao carregar propagandas");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingAd(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (ad) => {
    setEditingAd(ad);
    setForm({ name: ad.name, brand: ad.brand, price: ad.price, description: ad.description, affiliate_url: ad.affiliate_url, image_url: ad.image_url || "" });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.brand || !form.price || !form.affiliate_url) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    try {
      setSaving(true);
      const payload = { ...form, image_url: form.image_url || null };
      if (editingAd) {
        await axios.put(`${API}/advertisements/admin/${editingAd.id}`, payload, { withCredentials: true });
        toast.success("Propaganda atualizada!");
      } else {
        await axios.post(`${API}/advertisements/admin`, payload, { withCredentials: true });
        toast.success("Propaganda criada!");
      }
      setShowForm(false);
      loadAds();
    } catch (e) {
      toast.error("Erro ao salvar propaganda");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ad) => {
    try {
      await axios.put(`${API}/advertisements/admin/${ad.id}`, { is_active: !ad.is_active }, { withCredentials: true });
      toast.success(ad.is_active ? "Propaganda desativada" : "Propaganda ativada");
      loadAds();
    } catch (e) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleDelete = async (ad) => {
    if (!window.confirm(`Deletar "${ad.name}"?`)) return;
    try {
      await axios.delete(`${API}/advertisements/admin/${ad.id}`, { withCredentials: true });
      toast.success("Propaganda deletada!");
      loadAds();
    } catch (e) {
      toast.error("Erro ao deletar propaganda");
    }
  };

  return (
    <div>
      <Toaster richColors />
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-primary" />
            Propagandas Globais
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Visíveis em todas as barbearias (plano Free)</p>
        </div>
        <Button className="btn-gold" onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Propaganda
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-zinc-400">Carregando...</div>
      ) : ads.length === 0 ? (
        <Card className="p-12 text-center bg-surface border-border">
          <ShoppingBag className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
          <p className="text-zinc-400">Nenhuma propaganda cadastrada ainda.</p>
          <Button className="btn-gold mt-4" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />Criar primeira
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ads.map((ad) => (
            <Card key={ad.id} className={`bg-surface border-border p-4 ${!ad.is_active ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-white">{ad.name}</p>
                  <p className="text-sm text-zinc-400">{ad.brand}</p>
                </div>
                <Badge className={`text-xs ${ad.is_active ? "bg-green-900 text-green-300 border-green-700" : "bg-zinc-800 text-zinc-400 border-zinc-600"} border`}>
                  {ad.is_active ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              <p className="text-primary font-bold mb-1">{ad.price}</p>
              <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{ad.description}</p>
              <a href={ad.affiliate_url} target="_blank" rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:underline flex items-center gap-1 mb-4 truncate">
                <ExternalLink className="w-3 h-3 flex-shrink-0" />{ad.affiliate_url}
              </a>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => handleToggle(ad)}>
                  {ad.is_active ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                  {ad.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEdit(ad)}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(ad)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <Card className="bg-surface border-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editingAd ? "Editar Propaganda" : "Nova Propaganda"}</h2>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Nome do produto *</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Pomada Modeladora" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Marca *</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Ex: American Crew" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Preço *</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Ex: R$ 89,90" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Descrição</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex: Fixação forte, acabamento natural" />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">Link de afiliado *</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.affiliate_url} onChange={(e) => setForm({ ...form, affiliate_url: e.target.value })} placeholder="https://amzn.to/..." />
              </div>
              <div>
                <label className="text-sm text-zinc-400 block mb-1">URL da imagem (opcional)</label>
                <input className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                  value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://..." />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button className="btn-gold flex-1" onClick={handleSave} disabled={saving}>
                {saving ? "Salvando..." : editingAd ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
