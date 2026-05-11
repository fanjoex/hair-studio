import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CreditCard, Plus, Trash2, Send, CheckCircle, Clock, XCircle, Settings, Tv, Search, User, X } from "lucide-react";

const API = (window.__BACKEND_URL__ || window.location.origin) + "/api";

const STATUS_LABEL = {
  pending: { label: "Aguardando", icon: <Clock className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
  paid: { label: "Pago", icon: <CheckCircle className="w-4 h-4 text-green-400" />, color: "text-green-400" },
  cancelled: { label: "Cancelado", icon: <XCircle className="w-4 h-4 text-red-400" />, color: "text-red-400" },
};

export default function PaymentPage() {
  const [tab, setTab] = useState("charge"); // "charge" | "history" | "config"
  const [services, setServices] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [customAmount, setCustomAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [activeCharge, setActiveCharge] = useState(null);
  const [charges, setCharges] = useState([]);
  const [polling, setPolling] = useState(false);

  // Config
  const [gateway, setGateway] = useState("pix_manual");
  const [pixKey, setPixKey] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [psClientId, setPsClientId] = useState("");
  const [psClientSecret, setPsClientSecret] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadServices();
    loadConfig();
    loadCharges();
  }, []);

  // Poll charge status
  useEffect(() => {
    if (!activeCharge || activeCharge.status !== "pending") return;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/payment/public/charge/${activeCharge.charge_id}`);
        if (res.data.status !== "pending") {
          setActiveCharge(res.data);
          setPolling(false);
          loadCharges();
          if (res.data.status === "paid") toast.success("Pagamento confirmado!");
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [activeCharge]);

  const searchClients = async (q) => {
    setClientSearch(q);
    if (q.length < 2) { setClientResults([]); return; }
    try {
      const res = await axios.get(`${API}/payment/clients/search?q=${encodeURIComponent(q)}`, { withCredentials: true });
      setClientResults(res.data);
    } catch {}
  };

  const loadServices = async () => {
    try {
      const res = await axios.get(`${API}/barbershop/services`, { withCredentials: true });
      setServices(res.data.filter(s => s.active));
    } catch {}
  };

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${API}/payment/config`, { withCredentials: true });
      setGateway(res.data.gateway || "pix_manual");
      setPixKey(res.data.pix_key || "");
    } catch {}
  };

  const loadCharges = async () => {
    try {
      const res = await axios.get(`${API}/payment/charges`, { withCredentials: true });
      setCharges(res.data);
    } catch {}
  };

  const toggleService = (svc) => {
    setSelectedItems(prev => {
      const exists = prev.find(i => i.service_id === svc.id);
      if (exists) return prev.filter(i => i.service_id !== svc.id);
      return [...prev, { service_id: svc.id, name: svc.name, price: svc.price }];
    });
  };

  const total = () => {
    if (customAmount !== "") return parseFloat(customAmount) || 0;
    return selectedItems.reduce((sum, i) => sum + i.price, 0);
  };

  const handleCreateCharge = async () => {
    if (selectedItems.length === 0 && !customAmount) {
      toast.error("Selecione ao menos um serviço ou informe um valor");
      return;
    }
    if (total() <= 0) {
      toast.error("Valor inválido");
      return;
    }
    try {
      const res = await axios.post(`${API}/payment/charge`, {
        items: selectedItems.length > 0 ? selectedItems : [{ name: "Serviço avulso", price: total() }],
        custom_amount: customAmount !== "" ? parseFloat(customAmount) : null,
        client_id: selectedClient?.id || null,
        client_name: selectedClient?.name || clientName || null,
      }, { withCredentials: true });
      setActiveCharge(res.data);
      setPolling(true);
      toast.success("QR code gerado! Mostre no totem.");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao gerar cobrança");
    }
  };

  const handleConfirm = async () => {
    try {
      await axios.post(`${API}/payment/charge/${activeCharge.charge_id}/confirm`, {}, { withCredentials: true });
      setActiveCharge(prev => ({ ...prev, status: "paid" }));
      loadCharges();
      toast.success("Pagamento confirmado!");
    } catch (e) {
      toast.error("Erro ao confirmar");
    }
  };

  const handleCancel = async () => {
    try {
      await axios.post(`${API}/payment/charge/${activeCharge.charge_id}/cancel`, {}, { withCredentials: true });
      setActiveCharge(null);
      setSelectedItems([]);
      setCustomAmount("");
      loadCharges();
      toast.info("Cobrança cancelada");
    } catch {}
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await axios.put(`${API}/payment/config`, {
        gateway,
        pix_key: pixKey || null,
        access_token: mpToken || null,
        client_id: psClientId || null,
        client_secret: psClientSecret || null,
      }, { withCredentials: true });
      toast.success("Configuração salva!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao salvar");
    } finally {
      setSavingConfig(false);
    }
  };

  const sendToTotem = async () => {
    try {
      await axios.post(`${API}/payment/charge/${activeCharge.charge_id}/send-to-totem`, {}, { withCredentials: true });
      toast.success("QR code enviado para o totem!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao enviar para totem");
    }
  };

  const newCharge = () => {
    setActiveCharge(null);
    setSelectedItems([]);
    setCustomAmount("");
    setClientName("");
    setSelectedClient(null);
    setClientSearch("");
    setClientResults([]);
  };

  return (
    <div data-testid="payment-page">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="heading-1 mb-1">Pagamentos</h1>
          <p className="body-text">Gere cobranças Pix para o totem ou app</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {[
          { key: "charge", label: "Nova Cobrança" },
          { key: "history", label: "Histórico" },
          { key: "config", label: "Configurações" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); if (t.key === "history") loadCharges(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-zinc-400 hover:text-white"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: Nova Cobrança ===== */}
      {tab === "charge" && (
        <div className="grid gap-6 max-w-3xl">
          {!activeCharge ? (
            <>
              {/* Serviços */}
              <Card className="p-6 bg-surface border-border">
                <h2 className="text-base font-semibold text-white mb-4">Selecionar Serviços</h2>
                {services.length === 0 ? (
                  <p className="text-zinc-500 text-sm">Nenhum serviço cadastrado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {services.map(svc => {
                      const selected = selectedItems.some(i => i.service_id === svc.id);
                      return (
                        <button
                          key={svc.id}
                          onClick={() => toggleService(svc)}
                          className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${selected ? "border-primary bg-primary/10" : "border-border bg-background hover:border-zinc-500"}`}
                        >
                          <div>
                            <p className="text-sm font-medium text-white">{svc.name}</p>
                            <p className="text-xs text-zinc-400">{svc.duration_minutes} min</p>
                          </div>
                          <span className="text-primary font-bold text-sm">R$ {svc.price.toFixed(2)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Valor e cliente */}
              <Card className="p-6 bg-surface border-border">
                <h2 className="text-base font-semibold text-white mb-4">Detalhes da Cobrança</h2>
                <div className="space-y-4">
                  {/* Client selector */}
                  <div>
                    <Label className="text-zinc-300">Cliente (opcional)</Label>
                    {selectedClient ? (
                      <div className="flex items-center gap-2 mt-1 p-2 rounded-lg bg-primary/10 border border-primary/30">
                        <User className="w-4 h-4 text-primary shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{selectedClient.name}</p>
                          <p className="text-xs text-zinc-400">{selectedClient.phone}</p>
                        </div>
                        <button onClick={() => { setSelectedClient(null); setClientSearch(""); setClientResults([]); }} className="text-zinc-400 hover:text-white">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="relative mt-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                        <Input
                          value={clientSearch}
                          onChange={e => searchClients(e.target.value)}
                          placeholder="Buscar por nome ou telefone..."
                          className="bg-background border-border pl-9"
                        />
                        {clientResults.length > 0 && (
                          <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-zinc-900 border border-border rounded-lg shadow-xl overflow-hidden">
                            {clientResults.map(c => (
                              <button key={c.id} onClick={() => { setSelectedClient(c); setClientSearch(""); setClientResults([]); }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-zinc-800 text-left">
                                <User className="w-4 h-4 text-zinc-400 shrink-0" />
                                <div>
                                  <p className="text-sm text-white">{c.name}</p>
                                  <p className="text-xs text-zinc-400">{c.phone}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label className="text-zinc-300">Valor personalizado (substitui serviços selecionados)</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">R$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        placeholder="0,00"
                        className="bg-background border-border pl-8"
                      />
                    </div>
                    {customAmount && <p className="text-xs text-amber-400 mt-1">Valor personalizado será usado no lugar dos serviços selecionados</p>}
                  </div>

                  {/* Resumo */}
                  {(selectedItems.length > 0 || customAmount) && (
                    <div className="bg-zinc-900 rounded-lg p-4 border border-border">
                      <p className="text-xs text-zinc-400 mb-2">Resumo:</p>
                      {selectedItems.map(i => (
                        <div key={i.service_id} className="flex justify-between text-sm mb-1">
                          <span className="text-zinc-300">{i.name}</span>
                          <span className="text-white">R$ {i.price.toFixed(2)}</span>
                        </div>
                      ))}
                      {customAmount && (
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-amber-400">Valor personalizado</span>
                          <span className="text-amber-400">R$ {parseFloat(customAmount || 0).toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t border-border mt-2 pt-2 flex justify-between font-bold">
                        <span className="text-white">Total</span>
                        <span className="text-primary text-lg">R$ {total().toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleCreateCharge} className="w-full btn-gold">
                    <Send className="w-4 h-4 mr-2" />
                    Gerar QR Code Pix
                  </Button>
                </div>
              </Card>
            </>
          ) : (
            /* QR Code ativo */
            <Card className="p-6 bg-surface border-border text-center">
              <div className={`inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-sm font-medium ${activeCharge.status === "paid" ? "bg-green-500/10 text-green-400" : activeCharge.status === "cancelled" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                {STATUS_LABEL[activeCharge.status]?.icon}
                {STATUS_LABEL[activeCharge.status]?.label}
                {activeCharge.status === "pending" && <span className="ml-1 animate-pulse">...</span>}
              </div>

              <p className="text-zinc-400 text-sm mb-1">{activeCharge.description}</p>
              <p className="text-primary text-3xl font-bold mb-6">R$ {activeCharge.total?.toFixed(2)}</p>

              {activeCharge.status === "pending" && activeCharge.qr_code && (
                <>
                  <div className="flex justify-center mb-4">
                    <div className="bg-white p-3 rounded-lg">
                      <QRCodeSVG value={activeCharge.qr_code} size={200} level="H" />
                    </div>
                  </div>
                  <div className="bg-zinc-900 rounded p-2 mb-4 flex items-center gap-2">
                    <input readOnly value={activeCharge.qr_code} className="bg-transparent text-xs text-zinc-400 flex-1 outline-none truncate" />
                    <button onClick={() => { navigator.clipboard.writeText(activeCharge.qr_code); toast.success("Copiado!"); }} className="text-primary text-xs shrink-0">Copiar</button>
                  </div>
                  <div className="flex flex-wrap gap-3 justify-center">
                    <Button onClick={sendToTotem} className="btn-gold">
                      <Tv className="w-4 h-4 mr-2" />
                      Enviar para Totem
                    </Button>
                    {activeCharge.gateway !== "mercadopago" && (
                      <Button onClick={handleConfirm} variant="outline" className="border-green-500 text-green-400 hover:bg-green-500/10">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Pagamento
                      </Button>
                    )}
                    <Button variant="outline" onClick={handleCancel}>
                      <XCircle className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </>
              )}

              {activeCharge.status !== "pending" && (
                <Button onClick={newCharge} className="mt-4">Nova Cobrança</Button>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ===== TAB: Histórico ===== */}
      {tab === "history" && (
        <div className="max-w-3xl space-y-3">
          {charges.length === 0 ? (
            <p className="text-zinc-500 text-sm">Nenhuma cobrança encontrada.</p>
          ) : charges.map(c => (
            <Card key={c.id} className="p-4 bg-surface border-border flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{c.description}</p>
                <p className="text-zinc-400 text-xs">{c.client_name || "—"} · {new Date(c.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="text-right">
                <p className="text-primary font-bold">R$ {c.total?.toFixed(2)}</p>
                <div className={`flex items-center gap-1 justify-end text-xs ${STATUS_LABEL[c.status]?.color}`}>
                  {STATUS_LABEL[c.status]?.icon}
                  {STATUS_LABEL[c.status]?.label}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ===== TAB: Configurações ===== */}
      {tab === "config" && (
        <Card className="p-6 bg-surface border-border max-w-lg space-y-5">
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-white">Gateway de Pagamento</h2>
          </div>

          <div>
            <Label className="text-zinc-300 mb-2 block">Selecione o gateway</Label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "pix_manual", label: "Pix Manual" },
                { key: "mercadopago", label: "Mercado Pago" },
                { key: "pagseguro", label: "PagSeguro" },
              ].map(g => (
                <button key={g.key} onClick={() => setGateway(g.key)}
                  className={`p-3 rounded-lg border text-sm font-medium transition-all ${gateway === g.key ? "border-primary bg-primary/10 text-primary" : "border-border text-zinc-400 hover:border-zinc-500"}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {gateway === "pix_manual" && (
            <div>
              <Label className="text-zinc-300">Chave Pix</Label>
              <Input value={pixKey} onChange={e => setPixKey(e.target.value)} placeholder="CPF, CNPJ, email ou aleatória" className="bg-background border-border mt-1" />
              <p className="text-xs text-zinc-500 mt-1">O pagamento é confirmado manualmente pelo barbeiro.</p>
            </div>
          )}

          {gateway === "mercadopago" && (
            <div>
              <Label className="text-zinc-300">Access Token</Label>
              <Input type="password" value={mpToken} onChange={e => setMpToken(e.target.value)} placeholder="APP_USR-..." className="bg-background border-border mt-1" />
              <p className="text-xs text-zinc-500 mt-1">Encontre em mercadopago.com.br → Suas integrações → Credenciais.</p>
            </div>
          )}

          {gateway === "pagseguro" && (
            <div className="space-y-3">
              <div>
                <Label className="text-zinc-300">Client ID</Label>
                <Input value={psClientId} onChange={e => setPsClientId(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <div>
                <Label className="text-zinc-300">Client Secret</Label>
                <Input type="password" value={psClientSecret} onChange={e => setPsClientSecret(e.target.value)} className="bg-background border-border mt-1" />
              </div>
              <p className="text-xs text-zinc-500">Encontre em pagseguro.uol.com.br → Minha conta → Preferências → Integrações.</p>
            </div>
          )}

          <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
            {savingConfig ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </Card>
      )}
    </div>
  );
}
