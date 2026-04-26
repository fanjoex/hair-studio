import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { masterService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Users, Briefcase, MapPin, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BarbershopsList() {
  const [barbershops, setBarbershops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadBarbershops();
  }, []);

  const loadBarbershops = async () => {
    try {
      setLoading(true);
      const data = await masterService.listBarbershops();
      setBarbershops(data);
    } catch (error) {
      console.error("Error loading barbershops:", error);
      toast.error("Erro ao carregar barbearias");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await masterService.deleteBarbershop(deleteId);
      toast.success("Barbearia desativada com sucesso!");
      setDeleteId(null);
      loadBarbershops();
    } catch (error) {
      console.error("Error deleting barbershop:", error);
      toast.error("Erro ao desativar barbearia");
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: { label: "Ativa", className: "bg-green-500/10 text-green-500 border-green-500/20" },
      pending: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
      inactive: { label: "Inativa", className: "bg-red-500/10 text-red-500 border-red-500/20" },
    };

    const variant = variants[status] || variants.pending;

    return (
      <Badge className={`${variant.className} border`}>
        {variant.label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="body-text">Carregando barbearias...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="heading-1 mb-2">Barbearias</h1>
          <p className="body-text">{barbershops.length} barbearias cadastradas</p>
        </div>
        <Button
          onClick={() => navigate("/master/barbershops/new")}
          data-testid="create-barbershop-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Barbearia
        </Button>
      </div>

      {/* Lista de Barbearias */}
      {barbershops.length === 0 ? (
        <Card className="p-12 bg-surface border-border text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="heading-3 mb-2">Nenhuma barbearia cadastrada</h3>
            <p className="body-text mb-6">
              Comece criando sua primeira barbearia para gerenciar clientes e serviços.
            </p>
            <Button onClick={() => navigate("/master/barbershops/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeira Barbearia
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {barbershops.map((barbershop) => (
            <Card
              key={barbershop.id}
              className="p-6 bg-surface border-border hover:border-primary/20 transition-all duration-200"
              data-testid={`barbershop-card-${barbershop.id}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{barbershop.name}</h3>
                  {getStatusBadge(barbershop.status)}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/master/barbershops/${barbershop.id}/edit`)}
                    data-testid={`edit-barbershop-${barbershop.id}`}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteId(barbershop.id)}
                    className="text-red-500 hover:bg-red-500/10"
                    data-testid={`delete-barbershop-${barbershop.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {barbershop.address.street}, {barbershop.address.number} - {barbershop.address.city}/{barbershop.address.state}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Phone className="w-4 h-4" />
                  <span>{barbershop.phone}</span>
                </div>

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Mail className="w-4 h-4" />
                  <span>{barbershop.email}</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-purple-500/10 rounded-lg">
                    <Users className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Clientes</p>
                    <p className="text-lg font-semibold text-white">{barbershop.total_clients}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Briefcase className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-zinc-400">Serviços</p>
                    <p className="text-lg font-semibold text-white">{barbershop.total_services}</p>
                  </div>
                </div>
              </div>

              {/* Subscription */}
              <div className="mt-4 pt-4 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">Plano</span>
                  <Badge className="bg-primary/10 text-primary border-primary/20 border capitalize">
                    {barbershop.subscription.plan}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-surface border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Desativar Barbearia</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Tem certeza que deseja desativar esta barbearia? Esta ação marcará a barbearia como
              inativa, mas os dados não serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-zinc-800 text-white hover:bg-zinc-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
