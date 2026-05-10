import { useEffect, useState } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, User, Lock, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const API = (window.__BACKEND_URL__ || window.location.origin) + "/api";

export function AdminSettingsPage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Profile form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // 2FA verification
  const [verificationCode, setVerificationCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeAction, setCodeAction] = useState(""); // "update_profile" | "change_password"
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await axios.get(`${API}/admin/profile`, { withCredentials: true });
      setProfile(res.data);
      setName(res.data.name || "");
      setEmail(res.data.email || "");
      setPhone(res.data.phone || "");
    } catch (error) {
      toast.error("Erro ao carregar perfil");
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async (action) => {
    try {
      const res = await axios.post(`${API}/admin/send-verification-code`, { action }, { withCredentials: true });
      setCodeSent(true);
      setCodeAction(action);
      toast.success(res.data.message || "Código enviado para seu email!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao enviar código");
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (profile?.has_2fa && !verificationCode) {
      toast.error("Solicite e digite o código de verificação");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/admin/profile`, {
        name, email, phone,
        verification_code: verificationCode || "",
      }, { withCredentials: true });
      toast.success("Perfil atualizado!");
      setVerificationCode("");
      setCodeSent(false);
      setCodeAction("");
      loadProfile();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao atualizar");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (profile?.has_2fa && !verificationCode) {
      toast.error("Solicite e digite o código de verificação");
      return;
    }
    setSaving(true);
    try {
      await axios.put(`${API}/admin/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
        verification_code: verificationCode || "",
      }, { withCredentials: true });
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVerificationCode("");
      setCodeSent(false);
      setCodeAction("");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const TwoFABlock = ({ action }) => (
    profile?.has_2fa ? (
      <div className="p-4 bg-zinc-900 rounded-lg border border-border space-y-3">
        <p className="text-sm text-zinc-400 flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          Verificação em duas etapas — código enviado para seu email
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => sendCode(action)}
            disabled={codeSent && codeAction === action}
            className="shrink-0"
          >
            <Mail className="w-4 h-4 mr-1" />
            {codeSent && codeAction === action ? "✓ Enviado" : "Enviar Código"}
          </Button>
          <Input
            placeholder="000000"
            value={codeAction === action ? verificationCode : ""}
            onChange={(e) => { setVerificationCode(e.target.value); setCodeAction(action); }}
            maxLength={6}
            className="bg-background border-border w-36"
          />
        </div>
      </div>
    ) : null
  );

  return (
    <div data-testid="admin-settings-page">
      <div className="mb-8">
        <h1 className="heading-1 mb-2">Configurações</h1>
        <p className="body-text">Gerencie seu perfil e segurança</p>
      </div>

      <div className="grid gap-6 max-w-2xl">
        {/* 2FA Status */}
        <Card className="p-6 bg-surface border-border">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">Verificação em Duas Etapas</h2>
          </div>
          {profile?.has_2fa ? (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-green-400 text-sm font-medium">
                Ativa — código enviado para seu email cadastrado
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span className="text-amber-400 text-sm font-medium">
                Inativa — configure SMTP_EMAIL no servidor para ativar
              </span>
            </div>
          )}
        </Card>

        {/* Profile Form */}
        <Card className="p-6 bg-surface border-border">
          <div className="flex items-center gap-3 mb-6">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">Dados do Perfil</h2>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div>
              <Label className="text-zinc-300">Email (login)</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div>
              <Label className="text-zinc-300">Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="11999999999" className="bg-background border-border mt-1" />
            </div>
            <TwoFABlock action="update_profile" />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        </Card>

        {/* Password Form */}
        <Card className="p-6 bg-surface border-border">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-white">Alterar Senha</h2>
          </div>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label className="text-zinc-300">Senha Atual</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <div>
              <Label className="text-zinc-300">Nova Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-background border-border mt-1" placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <Label className="text-zinc-300">Confirmar Nova Senha</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-background border-border mt-1" />
            </div>
            <TwoFABlock action="change_password" />
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Alterando..." : "Alterar Senha"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
