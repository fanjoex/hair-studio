import { useEffect, useState, useRef } from "react";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Upload, Image as ImageIcon, BookOpen, Check } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

const CATEGORIES = [
  { value: "haircut", label: "Cabelo" },
  { value: "beard", label: "Barba" },
  { value: "combo", label: "Combo" },
];

export function StylesPage() {
  const [styles, setStyles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [formData, setFormData] = useState({ name: "", category: "haircut", description: "", prompt_template: "" });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [importing, setImporting] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.listStyles();
      setStyles(data);
    } catch (error) {
      toast.error("Erro ao carregar estilos");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({ name: "", category: "haircut", description: "", prompt_template: "" });
    setShowForm(true);
  };

  const openEdit = (style) => {
    setEditing(style);
    setFormData({
      name: style.name,
      category: style.category,
      description: style.description || "",
      prompt_template: style.prompt_template || "",
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await barbershopService.updateStyle(editing.id, formData);
        toast.success("Estilo atualizado!");
      } else {
        await barbershopService.createStyle(formData);
        toast.success("Estilo criado!");
      }
      setShowForm(false);
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (style) => {
    try {
      await barbershopService.updateStyle(style.id, { active: !style.active });
      toast.success(style.active ? "Estilo desativado" : "Estilo ativado");
      load();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await barbershopService.deleteStyle(deleteId);
      toast.success("Estilo removido!");
      setDeleteId(null);
      load();
    } catch (error) {
      toast.error("Erro ao remover");
    }
  };

  const openCatalog = async () => {
    setShowCatalog(true);
    setCatalogLoading(true);
    try {
      const data = await barbershopService.getCatalogStyles();
      setCatalog(data);
    } catch (error) {
      toast.error("Erro ao carregar catálogo");
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleImport = async (globalId) => {
    setImporting(globalId);
    try {
      await barbershopService.importCatalogStyle(globalId);
      toast.success("Estilo importado!");
      setCatalog((prev) => prev.map((s) => (s.id === globalId ? { ...s, imported: true } : s)));
      load();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao importar");
    } finally {
      setImporting(null);
    }
  };

  const handleUploadImage = async (e, styleId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(styleId);
    try {
      await barbershopService.uploadStyleImage(styleId, file);
      toast.success("Imagem enviada!");
      load();
    } catch (error) {
      toast.error("Erro ao enviar imagem");
    } finally {
      setUploading(null);
    }
  };

  const getCategoryBadge = (cat) => {
    const colors = {
      haircut: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      beard: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      combo: "bg-green-500/10 text-green-500 border-green-500/20",
    };
    const label = CATEGORIES.find((c) => c.value === cat)?.label || cat;
    return <Badge className={`${colors[cat] || colors.haircut} border`}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="styles-page">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="heading-1 mb-2">Estilos de Corte</h1>
          <p className="body-text">{styles.length} estilos cadastrados — visíveis para seus clientes no link de agendamento</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={openCatalog} data-testid="open-catalog-button">
            <BookOpen className="w-4 h-4 mr-2" />
            Catálogo
          </Button>
          <Button onClick={openCreate} data-testid="add-style-button">
            <Plus className="w-4 h-4 mr-2" />
            Novo Estilo
          </Button>
        </div>
      </div>

      {styles.length === 0 ? (
        <Card className="p-12 bg-surface border-border text-center">
          <div className="max-w-md mx-auto">
            <h3 className="heading-3 mb-2">Nenhum estilo cadastrado</h3>
            <p className="body-text mb-6">Cadastre estilos de corte para seus clientes experimentarem com IA</p>
            <Button onClick={openCreate}><Plus className="w-4 h-4 mr-2" />Cadastrar Estilo</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {styles.map((style) => (
            <Card key={style.id} className={`bg-surface border-border hover:border-primary/20 transition-all ${!style.active ? "opacity-60" : ""}`} data-testid={`style-card-${style.id}`}>
              {/* Image */}
              <div className="relative w-full bg-zinc-950 aspect-[3/4] flex items-center justify-center">
                {style.has_image ? (
                  <img src={`${API}/public/style-image/${style.id}`} alt={style.name} className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon className="w-12 h-12 text-zinc-700" />
                )}
                <div className="absolute top-2 right-2 flex gap-1">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImage(e, style.id)} />
                    <div className="p-1.5 bg-black/60 rounded-md hover:bg-black/80 transition-colors">
                      <Upload className={`w-4 h-4 text-white ${uploading === style.id ? "animate-pulse" : ""}`} />
                    </div>
                  </label>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-semibold text-white">{style.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(style)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(style.id)} className="text-red-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                {style.description && <p className="text-sm text-zinc-500 mb-3 line-clamp-2">{style.description}</p>}
                <div className="flex items-center gap-2">
                  {getCategoryBadge(style.category)}
                  <button
                    onClick={() => handleToggleActive(style)}
                    className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${style.active ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}`}
                    data-testid={`toggle-style-${style.id}`}
                  >
                    {style.active ? "Ativo" : "Inativo"}
                  </button>
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
            <DialogTitle className="text-white">{editing ? "Editar Estilo" : "Novo Estilo"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Nome do Estilo *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required className="mt-1 bg-background border-border text-white" placeholder="Ex: Degradê Moderno" data-testid="style-name-input" />
            </div>
            <div>
              <Label className="text-zinc-300">Categoria *</Label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="mt-1 w-full h-10 rounded-md border border-border bg-background text-white px-3" data-testid="style-category-select">
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-zinc-300">Descrição</Label>
              <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="mt-1 bg-background border-border text-white" placeholder="Descrição breve do estilo..." data-testid="style-description-input" />
            </div>
            <div>
              <Label className="text-zinc-300">Prompt da IA (opcional)</Label>
              <Input value={formData.prompt_template} onChange={(e) => setFormData({ ...formData, prompt_template: e.target.value })} className="mt-1 bg-background border-border text-white" placeholder="Se vazio, será gerado automaticamente" data-testid="style-prompt-input" />
              <p className="text-xs text-zinc-500 mt-1">Instrução para a IA transformar a foto do cliente</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving} className="flex-1" data-testid="save-style-button">{saving ? "Salvando..." : editing ? "Atualizar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Catalog Dialog */}
      <Dialog open={showCatalog} onOpenChange={setShowCatalog}>
        <DialogContent className="bg-surface border-border max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Catálogo de Sugestões</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400 mb-4">
            Selecione estilos do catálogo para oferecer aos seus clientes. Você pode editar após importar.
          </p>
          {catalogLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.map((g) => (
                <Card key={g.id} className="bg-background border-border overflow-hidden">
                  <div className="relative h-32 bg-zinc-900">
                    {g.image_url ? (
                      <img src={g.image_url} alt={g.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-10 h-10 text-zinc-700" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-white text-sm mb-1">{g.name}</h4>
                    {g.description && (
                      <p className="text-xs text-zinc-500 mb-2 line-clamp-2">{g.description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      {getCategoryBadge(g.category)}
                      {g.imported ? (
                        <span className="text-xs text-green-500 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Importado
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleImport(g.id)}
                          disabled={importing === g.id}
                          data-testid={`import-style-${g.id}`}
                        >
                          {importing === g.id ? "..." : "Importar"}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Remover Estilo</AlertDialogTitle>
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
