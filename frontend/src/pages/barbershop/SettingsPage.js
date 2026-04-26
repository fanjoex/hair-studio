import { useEffect, useState } from "react";
import { barbershopService } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clock } from "lucide-react";

const DAYS = [
  { key: "monday", label: "Segunda-feira" },
  { key: "tuesday", label: "Terça-feira" },
  { key: "wednesday", label: "Quarta-feira" },
  { key: "thursday", label: "Quinta-feira" },
  { key: "friday", label: "Sexta-feira" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
];

const DEFAULT_DAY = { open: "08:00", close: "18:00", enabled: true };

export function SettingsPage() {
  const [hours, setHours] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingLink, setBookingLink] = useState("");
  const [stylesLink, setStylesLink] = useState("");
  const [totemLink, setTotemLink] = useState("");

  useEffect(() => {
    loadHours();
    const loadBarbershopId = async () => {
      try {
        const wh = await barbershopService.getWorkingHours();
        if (wh.barbershop_id) {
          const base = window.location.origin;
          setBookingLink(`${base}/agendar/${wh.barbershop_id}`);
          setStylesLink(`${base}/experimentar/${wh.barbershop_id}`);
          setTotemLink(`${base}/totem/${wh.barbershop_id}`);
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadBarbershopId();
  }, []);

  const loadHours = async () => {
    try {
      setLoading(true);
      const data = await barbershopService.getWorkingHours();
      const parsed = {};
      DAYS.forEach(({ key }) => {
        const day = data[key];
        parsed[key] = day ? { open: day.open || "08:00", close: day.close || "18:00", enabled: day.enabled !== false } : { ...DEFAULT_DAY, enabled: false };
      });
      setHours(parsed);
    } catch (error) {
      toast.error("Erro ao carregar horários");
    } finally {
      setLoading(false);
    }
  };

  const updateDay = (key, field, value) => {
    setHours((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      DAYS.forEach(({ key }) => {
        const d = hours[key];
        if (d.enabled) {
          payload[key] = { open: d.open, close: d.close, enabled: true };
        } else {
          payload[key] = { open: d.open, close: d.close, enabled: false };
        }
      });
      await barbershopService.updateWorkingHours(payload);
      toast.success("Horários salvos!");
    } catch (error) {
      toast.error("Erro ao salvar horários");
    } finally {
      setSaving(false);
    }
  };

  const copyLink = (link) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
      </div>
    );
  }

  return (
    <div data-testid="settings-page">
      <div className="mb-8">
        <h1 className="heading-1 mb-2">Configurações</h1>
        <p className="body-text">Horários de funcionamento e link de agendamento</p>
      </div>

      {/* Booking Link */}
      {bookingLink && (
        <Card className="p-6 bg-surface border-border mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Link de Agendamento</h3>
          <p className="text-sm text-zinc-400 mb-3">Compartilhe com seus clientes para agendarem online:</p>
          <div className="flex gap-2">
            <Input value={bookingLink} readOnly className="bg-background border-border text-white flex-1" data-testid="booking-link-input" />
            <Button onClick={() => copyLink(bookingLink)} data-testid="copy-link-button">Copiar</Button>
          </div>
        </Card>
      )}

      {/* Styles Link */}
      {stylesLink && (
        <Card className="p-6 bg-surface border-border mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Link de Estilos com IA</h3>
          <p className="text-sm text-zinc-400 mb-3">Compartilhe para seus clientes experimentarem cortes com IA:</p>
          <div className="flex gap-2">
            <Input value={stylesLink} readOnly className="bg-background border-border text-white flex-1" data-testid="styles-link-input" />
            <Button onClick={() => copyLink(stylesLink)} data-testid="copy-styles-link-button">Copiar</Button>
          </div>
        </Card>
      )}

      {/* Totem Link */}
      {totemLink && (
        <Card className="p-6 bg-surface border-border mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Link do Totem (modo kiosk)</h3>
          <p className="text-sm text-zinc-400 mb-3">Use em um tablet/totem dentro da barbearia. Reseta automaticamente após 60-90s de inatividade.</p>
          <div className="flex gap-2">
            <Input value={totemLink} readOnly className="bg-background border-border text-white flex-1" data-testid="totem-link-input" />
            <Button onClick={() => copyLink(totemLink)} data-testid="copy-totem-link-button">Copiar</Button>
            <Button variant="outline" onClick={() => window.open(totemLink, "_blank")} data-testid="open-totem-button">Abrir</Button>
          </div>
        </Card>
      )}

      {/* Working Hours */}
      <Card className="p-6 bg-surface border-border">
        <div className="flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-white">Horários de Funcionamento</h3>
        </div>

        <div className="space-y-4">
          {DAYS.map(({ key, label }) => {
            const day = hours[key] || DEFAULT_DAY;
            return (
              <div key={key} className="flex items-center gap-4 py-3 border-b border-zinc-800 last:border-0">
                <div className="w-36">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={day.enabled}
                      onChange={(e) => updateDay(key, "enabled", e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-600 text-primary focus:ring-primary bg-zinc-800"
                      data-testid={`day-toggle-${key}`}
                    />
                    <span className={`text-sm font-medium ${day.enabled ? "text-white" : "text-zinc-500"}`}>{label}</span>
                  </label>
                </div>
                {day.enabled ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={day.open}
                      onChange={(e) => updateDay(key, "open", e.target.value)}
                      className="w-32 bg-background border-border text-white"
                      data-testid={`day-open-${key}`}
                    />
                    <span className="text-zinc-500">até</span>
                    <Input
                      type="time"
                      value={day.close}
                      onChange={(e) => updateDay(key, "close", e.target.value)}
                      className="w-32 bg-background border-border text-white"
                      data-testid={`day-close-${key}`}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-zinc-500">Fechado</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6">
          <Button onClick={handleSave} disabled={saving} data-testid="save-hours-button">
            {saving ? "Salvando..." : "Salvar Horários"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
