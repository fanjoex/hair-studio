import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Mail, KeyRound, Check } from "lucide-react";

import "@/App.css";

export function AuthDialog({ open, onClose }) {
  const [mode, setMode] = useState("login"); // login, register, reset-request, reset-confirm, reset-done
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register, requestPasswordReset, confirmPasswordReset } = useAuth();

  const resetForm = () => {
    setName("");
    setEmail("");
    setPassword("");
    setResetCode("");
    setNewPassword("");
    setDisplayCode("");
    setLoading(false);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => { setMode("login"); resetForm(); }, 300);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(email, password);
    setLoading(false);
    if (success) { handleClose(); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await register(name, email, password);
    setLoading(false);
    if (success) { handleClose(); }
  };

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await requestPasswordReset(email);
    setLoading(false);
    if (result) {
      if (result.code) {
        setDisplayCode(result.code);
      }
      setMode("reset-confirm");
    }
  };

  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    const success = await confirmPasswordReset(email, resetCode, newPassword);
    setLoading(false);
    if (success) {
      setMode("reset-done");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-surface border-border">
        {/* LOGIN */}
        {mode === "login" && (
          <>
            <DialogHeader>
              <DialogTitle className="heading-3">Entrar</DialogTitle>
              <DialogDescription className="body-text">Entre para acessar o sistema</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="login-email" className="text-zinc-300">Email</Label>
                <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background border-border text-white mt-2" data-testid="auth-email-input" />
              </div>
              <div>
                <Label htmlFor="login-password" className="text-zinc-300">Senha</Label>
                <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background border-border text-white mt-2" data-testid="auth-password-input" />
              </div>
              <Button type="submit" className="btn-gold w-full" disabled={loading} data-testid="auth-submit-button">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setMode("reset-request"); resetForm(); }} className="text-primary hover:underline" data-testid="forgot-password-link">
                  Esqueci minha senha
                </button>
                <button type="button" onClick={() => { setMode("register"); resetForm(); }} className="text-primary hover:underline">
                  Criar conta
                </button>
              </div>
            </form>
          </>
        )}

        {/* REGISTER */}
        {mode === "register" && (
          <>
            <DialogHeader>
              <DialogTitle className="heading-3">Criar Conta</DialogTitle>
              <DialogDescription className="body-text">Crie sua conta gratuitamente</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Label className="text-zinc-300">Nome</Label>
                <Input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background border-border text-white mt-2" data-testid="auth-name-input" />
              </div>
              <div>
                <Label className="text-zinc-300">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background border-border text-white mt-2" data-testid="auth-email-input" />
              </div>
              <div>
                <Label className="text-zinc-300">Senha</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background border-border text-white mt-2" data-testid="auth-password-input" />
              </div>
              <Button type="submit" className="btn-gold w-full" disabled={loading} data-testid="auth-submit-button">
                {loading ? "Criando..." : "Criar Conta"}
              </Button>
              <p className="text-center text-sm text-zinc-400">
                Já tem conta?{" "}
                <button type="button" onClick={() => { setMode("login"); resetForm(); }} className="text-primary hover:underline">Entrar</button>
              </p>
            </form>
          </>
        )}

        {/* RESET REQUEST */}
        {mode === "reset-request" && (
          <>
            <DialogHeader>
              <DialogTitle className="heading-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" />Recuperar Senha
              </DialogTitle>
              <DialogDescription className="body-text">Informe seu email para receber o código de recuperação</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRequestReset} className="space-y-4">
              <div>
                <Label className="text-zinc-300">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background border-border text-white mt-2" placeholder="seu@email.com" data-testid="reset-email-input" />
              </div>
              <Button type="submit" className="btn-gold w-full" disabled={loading} data-testid="reset-request-button">
                {loading ? "Enviando..." : "Enviar Código"}
              </Button>
              <button type="button" onClick={() => { setMode("login"); resetForm(); }} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />Voltar ao login
              </button>
            </form>
          </>
        )}

        {/* RESET CONFIRM */}
        {mode === "reset-confirm" && (
          <>
            <DialogHeader>
              <DialogTitle className="heading-3 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />Nova Senha
              </DialogTitle>
              <DialogDescription className="body-text">Digite o código recebido e sua nova senha</DialogDescription>
            </DialogHeader>

            {displayCode && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center" data-testid="reset-code-display">
                <p className="text-xs text-zinc-400 mb-1">Seu código de recuperação:</p>
                <p className="text-2xl font-mono font-bold text-primary tracking-widest">{displayCode}</p>
                <p className="text-xs text-zinc-500 mt-1">Em produção, este código seria enviado por email</p>
              </div>
            )}

            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <Label className="text-zinc-300">Código de 6 dígitos</Label>
                <Input
                  type="text"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  maxLength={6}
                  className="bg-background border-border text-white mt-2 text-center text-xl tracking-widest font-mono"
                  placeholder="000000"
                  data-testid="reset-code-input"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Nova Senha (mín. 6 caracteres)</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} className="bg-background border-border text-white mt-2" data-testid="reset-new-password-input" />
              </div>
              <Button type="submit" className="btn-gold w-full" disabled={loading || resetCode.length !== 6} data-testid="reset-confirm-button">
                {loading ? "Alterando..." : "Alterar Senha"}
              </Button>
              <button type="button" onClick={() => { setMode("reset-request"); setDisplayCode(""); setResetCode(""); }} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors">
                <ArrowLeft className="w-4 h-4" />Reenviar código
              </button>
            </form>
          </>
        )}

        {/* RESET DONE */}
        {mode === "reset-done" && (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="heading-3 mb-2">Senha Alterada!</h3>
            <p className="body-text mb-6">Sua senha foi alterada com sucesso. Faça login com a nova senha.</p>
            <Button onClick={() => { setMode("login"); resetForm(); }} className="btn-gold w-full" data-testid="back-to-login-button">
              Fazer Login
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
