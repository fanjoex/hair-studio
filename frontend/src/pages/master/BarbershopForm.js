import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { masterService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function BarbershopForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    document: "",
    phone: "",
    email: "",
    owner_email: "",
    address: {
      street: "",
      number: "",
      complement: "",
      neighborhood: "",
      city: "",
      state: "",
      zip_code: "",
    },
  });

  useEffect(() => {
    if (isEditing) {
      loadBarbershop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadBarbershop = async () => {
    try {
      setLoading(true);
      const data = await masterService.getBarbershop(id);
      setFormData({
        name: data.name,
        document: data.document || "",
        phone: data.phone,
        email: data.email,
        owner_email: "",
        address: data.address,
      });
    } catch (error) {
      console.error("Error loading barbershop:", error);
      toast.error("Erro ao carregar barbearia");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("address.")) {
      const addressField = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          [addressField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);

      if (isEditing) {
        await masterService.updateBarbershop(id, {
          name: formData.name,
          document: formData.document,
          phone: formData.phone,
          email: formData.email,
          address: formData.address,
        });
        toast.success("Barbearia atualizada com sucesso!");
      } else {
        await masterService.createBarbershop(formData);
        toast.success("Barbearia criada com sucesso!");
      }

      navigate("/master/barbershops");
    } catch (error) {
      console.error("Error saving barbershop:", error);
      toast.error(error.response?.data?.detail || "Erro ao salvar barbearia");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/master/barbershops")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <h1 className="heading-1 mb-2">
          {isEditing ? "Editar Barbearia" : "Nova Barbearia"}
        </h1>
        <p className="body-text">
          {isEditing ? "Atualize as informações da barbearia" : "Preencha os dados para criar uma nova barbearia"}
        </p>
      </div>

      {/* Form */}
      <Card className="p-6 lg:p-8 bg-surface border-border max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informações Básicas */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="name" className="text-zinc-300">
                  Nome da Barbearia *
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="Ex: Barbearia Premium"
                />
              </div>

              <div>
                <Label htmlFor="document" className="text-zinc-300">
                  CNPJ/CPF
                </Label>
                <Input
                  id="document"
                  name="document"
                  value={formData.document}
                  onChange={handleChange}
                  className="mt-2 bg-background border-border text-white"
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-zinc-300">
                  Telefone *
                </Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="(00) 00000-0000"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-zinc-300">
                  Email *
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="contato@barbearia.com"
                />
              </div>

              {!isEditing && (
                <div>
                  <Label htmlFor="owner_email" className="text-zinc-300">
                    Email do Dono
                  </Label>
                  <Input
                    id="owner_email"
                    name="owner_email"
                    type="email"
                    value={formData.owner_email}
                    onChange={handleChange}
                    className="mt-2 bg-background border-border text-white"
                    placeholder="dono@email.com"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Será criado um usuário com senha padrão: mudar123
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="address.zip_code" className="text-zinc-300">
                  CEP *
                </Label>
                <Input
                  id="address.zip_code"
                  name="address.zip_code"
                  value={formData.address.zip_code}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="00000-000"
                />
              </div>

              <div>
                <Label htmlFor="address.street" className="text-zinc-300">
                  Rua *
                </Label>
                <Input
                  id="address.street"
                  name="address.street"
                  value={formData.address.street}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="Rua Principal"
                />
              </div>

              <div>
                <Label htmlFor="address.number" className="text-zinc-300">
                  Número *
                </Label>
                <Input
                  id="address.number"
                  name="address.number"
                  value={formData.address.number}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="123"
                />
              </div>

              <div>
                <Label htmlFor="address.complement" className="text-zinc-300">
                  Complemento
                </Label>
                <Input
                  id="address.complement"
                  name="address.complement"
                  value={formData.address.complement}
                  onChange={handleChange}
                  className="mt-2 bg-background border-border text-white"
                  placeholder="Loja 1"
                />
              </div>

              <div>
                <Label htmlFor="address.neighborhood" className="text-zinc-300">
                  Bairro *
                </Label>
                <Input
                  id="address.neighborhood"
                  name="address.neighborhood"
                  value={formData.address.neighborhood}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="Centro"
                />
              </div>

              <div>
                <Label htmlFor="address.city" className="text-zinc-300">
                  Cidade *
                </Label>
                <Input
                  id="address.city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleChange}
                  required
                  className="mt-2 bg-background border-border text-white"
                  placeholder="São Paulo"
                />
              </div>

              <div>
                <Label htmlFor="address.state" className="text-zinc-300">
                  Estado *
                </Label>
                <Input
                  id="address.state"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleChange}
                  required
                  maxLength={2}
                  className="mt-2 bg-background border-border text-white"
                  placeholder="SP"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/master/barbershops")}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
              data-testid="submit-barbershop-form"
            >
              {loading ? "Salvando..." : isEditing ? "Atualizar" : "Criar Barbearia"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
