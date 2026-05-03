import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { clientService } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast, Toaster } from "sonner";
import "@/App.css";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

export function ClientRegister() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkAuth } = useAuth();
  const barbershopId = searchParams.get("b") || "";
  const [barbershopName, setBarbershopName] = useState("");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!barbershopId) return;
    axios
      .get(`${API}/public/barbershop/${barbershopId}/styles`)
      .then(({ data }) => setBarbershopName(data.barbershop_name || ""))
      .catch(() => {});
  }, [barbershopId]);

  // Bloquear cadastro sem barbearia vinculada
  if (!barbershopId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Toaster position="top-center" richColors />
        <Card className="w-full max-w-md p-6 sm:p-8 bg-surface border-border text-center">
          <h1 className="text-2xl font-bold text-gold mb-3">Link inválido</h1>
          <p className="text-sm text-zinc-400 mb-6">
            O cadastro de cliente só pode ser feito através do link de uma barbearia.
            Peça o link para a barbearia em que você deseja se cadastrar.
          </p>
          <Button onClick={() => navigate("/login")} className="btn-gold w-full">
            Voltar para o login
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      toast.error("Preencha nome, e-mail e senha");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Senha deve ter pelo menos 6 caracteres");
      return;
    }
    setSubmitting(true);
    try {
      await clientService.register({
        ...form,
        barbershop_id: barbershopId || undefined,
      });
      toast.success("Cadastro realizado!");
      if (checkAuth) await checkAuth();
      navigate("/cliente", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao cadastrar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      <Card className="w-full max-w-md p-6 sm:p-8 bg-surface border-border">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gold mb-1">Criar Conta</h1>
          {barbershopName ? (
            <p className="text-sm text-zinc-400">Cliente da <span className="text-primary">{barbershopName}</span></p>
          ) : (
            <p className="text-sm text-zinc-400">Acesse seus agendamentos e estilos</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="text-zinc-300">Nome completo *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="mt-1 bg-background border-border text-white"
              placeholder="Seu nome"
              data-testid="client-register-name"
            />
          </div>
          <div>
            <Label className="text-zinc-300">E-mail *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="mt-1 bg-background border-border text-white"
              placeholder="seu@email.com"
              data-testid="client-register-email"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Telefone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="mt-1 bg-background border-border text-white"
              placeholder="(11) 91234-5678"
              data-testid="client-register-phone"
            />
          </div>
          <div>
            <Label className="text-zinc-300">Senha *</Label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              className="mt-1 bg-background border-border text-white"
              placeholder="Mínimo 6 caracteres"
              data-testid="client-register-password"
            />
          </div>

          <Button type="submit" disabled={submitting} className="btn-gold w-full" data-testid="client-register-submit">
            {submitting ? "Criando..." : "Criar Conta"}
          </Button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => navigate("/login")}
            className="text-sm text-zinc-400 hover:text-primary transition-colors"
          >
            Já tenho conta
          </button>
        </div>
      </Card>
    </div>
  );
}
