import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export function AuthDialog({ open, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const success = isLogin
      ? await login(email, password)
      : await register(name, email, password);
    if (success) {
      onClose();
      setName("");
      setEmail("");
      setPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border">
        <DialogHeader>
          <DialogTitle className="heading-3">{isLogin ? "Entrar" : "Criar Conta"}</DialogTitle>
          <DialogDescription className="body-text">
            {isLogin ? "Entre para salvar seus resultados" : "Crie sua conta gratuitamente"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <Label htmlFor="name" className="text-zinc-300">Nome</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
                className="bg-background border-border text-white mt-2"
                data-testid="auth-name-input"
              />
            </div>
          )}
          <div>
            <Label htmlFor="email" className="text-zinc-300">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-border text-white mt-2"
              data-testid="auth-email-input"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-zinc-300">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-background border-border text-white mt-2"
              data-testid="auth-password-input"
            />
          </div>
          <Button type="submit" className="w-full" data-testid="auth-submit-button">
            {isLogin ? "Entrar" : "Criar Conta"}
          </Button>
          <p className="text-center text-sm text-zinc-400">
            {isLogin ? "Não tem conta? " : "Já tem conta? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin ? "Criar agora" : "Entrar"}
            </button>
          </p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
