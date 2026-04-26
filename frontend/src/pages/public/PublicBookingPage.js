import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Clock, DollarSign, MapPin, Phone, ChevronLeft, ChevronRight, Check, MessageCircle } from "lucide-react";
import { toast, Toaster } from "sonner";
import { generateWhatsAppLink } from "@/utils/whatsapp";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

const CATEGORY_LABELS = { haircut: "Cabelo", beard: "Barba", combo: "Combo", other: "Outro" };

function getNextDays(count) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function formatShortDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return { day: d.getDate(), weekday: dayNames[d.getDay()], month: d.toLocaleString("pt-BR", { month: "short" }) };
}

export default function PublicBookingPage() {
  const { barbershopId } = useParams();
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0); // 0: service, 1: professional, 2: date/time, 3: contact, 4: confirmation
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(null);

  useEffect(() => {
    loadInfo();
  }, [barbershopId]);

  const loadInfo = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/public/barbershop/${barbershopId}`);
      setInfo(data);
    } catch (e) {
      toast.error("Barbearia não encontrada");
    } finally {
      setLoading(false);
    }
  };

  const loadSlots = async (date) => {
    if (!selectedService || !selectedProfessional) return;
    try {
      setLoadingSlots(true);
      const { data } = await axios.get(`${API}/public/barbershop/${barbershopId}/available-slots`, {
        params: { date, professional_id: selectedProfessional.id, service_id: selectedService.id },
      });
      setSlots(data.slots || []);
    } catch (e) {
      toast.error("Erro ao carregar horários");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (selectedDate && selectedProfessional && selectedService) {
      loadSlots(selectedDate);
      setSelectedSlot(null);
    }
  }, [selectedDate, selectedProfessional, selectedService]);

  const handleBook = async () => {
    if (!clientName || !clientPhone) { toast.error("Preencha nome e telefone"); return; }
    setBooking(true);
    try {
      const { data } = await axios.post(`${API}/public/barbershop/${barbershopId}/book`, {
        professional_id: selectedProfessional.id,
        service_id: selectedService.id,
        client_name: clientName,
        client_phone: clientPhone,
        date: selectedDate,
        start_time: selectedSlot.start,
      });
      setConfirmed(data);
      setStep(4);
      toast.success("Agendamento confirmado!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao agendar");
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!info) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="p-8 bg-surface border-border text-center max-w-md">
          <h2 className="heading-2 mb-2">Barbearia não encontrada</h2>
          <p className="body-text">Verifique o link e tente novamente.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />
      {/* Header */}
      <header className="bg-surface border-b border-border p-4 text-center">
        <h1 className="text-2xl font-bold text-primary" data-testid="public-barbershop-name">{info.name}</h1>
        {info.address && (
          <p className="text-sm text-zinc-400 mt-1 flex items-center justify-center gap-1">
            <MapPin className="w-3.5 h-3.5" />{info.address.street}, {info.address.number} - {info.address.city}/{info.address.state}
          </p>
        )}
        {info.phone && <p className="text-xs text-zinc-500 mt-1 flex items-center justify-center gap-1"><Phone className="w-3 h-3" />{info.phone}</p>}
      </header>

      <div className="max-w-2xl mx-auto p-6">
        {/* Progress */}
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-8">
            {["Serviço", "Profissional", "Data/Hora", "Dados"].map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${i <= step ? "bg-primary text-black" : "bg-zinc-800 text-zinc-500"}`}>{i < step ? <Check className="w-4 h-4" /> : i + 1}</div>
                <span className={`text-xs hidden sm:inline ${i <= step ? "text-white" : "text-zinc-500"}`}>{label}</span>
                {i < 3 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-zinc-800"}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 0: Service */}
        {step === 0 && (
          <div data-testid="step-service">
            <h2 className="heading-2 mb-4">Escolha o Serviço</h2>
            <div className="space-y-3">
              {info.services.map((s) => (
                <Card key={s.id} onClick={() => { setSelectedService(s); setStep(1); }}
                  className={`p-4 bg-surface border-border cursor-pointer hover:border-primary/30 transition-all ${selectedService?.id === s.id ? "border-primary" : ""}`}
                  data-testid={`public-service-${s.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white">{s.name}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700 border text-xs">{CATEGORY_LABELS[s.category] || s.category}</Badge>
                        <span className="text-sm text-zinc-400 flex items-center gap-1"><Clock className="w-3 h-3" />{s.duration_minutes} min</span>
                      </div>
                    </div>
                    <p className="text-lg font-bold text-primary flex items-center"><DollarSign className="w-4 h-4" />R$ {s.price.toFixed(2)}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Professional */}
        {step === 1 && (
          <div data-testid="step-professional">
            <h2 className="heading-2 mb-4">Escolha o Profissional</h2>
            <div className="space-y-3">
              {info.professionals.map((p) => (
                <Card key={p.id} onClick={() => { setSelectedProfessional(p); setStep(2); setSelectedDate(getNextDays(1)[0]); }}
                  className="p-4 bg-surface border-border cursor-pointer hover:border-primary/30 transition-all"
                  data-testid={`public-professional-${p.id}`}
                >
                  <h3 className="font-semibold text-white">{p.name}</h3>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.specialties?.map((s) => <Badge key={s} className="bg-primary/10 text-primary border-primary/20 border text-xs">{CATEGORY_LABELS[s] || s}</Badge>)}
                  </div>
                </Card>
              ))}
            </div>
            <Button variant="outline" className="mt-4" onClick={() => setStep(0)}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>
          </div>
        )}

        {/* Step 2: Date/Time */}
        {step === 2 && (
          <div data-testid="step-datetime">
            <h2 className="heading-2 mb-4">Escolha Data e Horário</h2>
            {/* Date selector */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-4">
              {getNextDays(14).map((d) => {
                const { day, weekday, month } = formatShortDate(d);
                const selected = d === selectedDate;
                return (
                  <button key={d} onClick={() => setSelectedDate(d)}
                    className={`flex-shrink-0 w-16 py-3 rounded-lg text-center transition-all border ${selected ? "bg-primary text-black border-primary" : "bg-surface border-border text-zinc-400 hover:border-zinc-500"}`}
                    data-testid={`date-${d}`}
                  >
                    <p className="text-xs">{weekday}</p>
                    <p className="text-lg font-bold">{day}</p>
                    <p className="text-xs">{month}</p>
                  </button>
                );
              })}
            </div>
            {/* Time slots */}
            {loadingSlots ? (
              <div className="flex justify-center py-8"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
            ) : slots.length === 0 ? (
              <Card className="p-6 bg-surface border-border text-center"><p className="body-text">Nenhum horário disponível neste dia</p></Card>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {slots.map((slot) => (
                  <button key={slot.start} onClick={() => { setSelectedSlot(slot); setStep(3); }}
                    className={`py-3 rounded-lg text-sm font-medium transition-all border ${selectedSlot?.start === slot.start ? "bg-primary text-black border-primary" : "bg-surface border-border text-white hover:border-primary/30"}`}
                    data-testid={`slot-${slot.start}`}
                  >
                    {slot.start}
                  </button>
                ))}
              </div>
            )}
            <Button variant="outline" className="mt-4" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>
          </div>
        )}

        {/* Step 3: Contact */}
        {step === 3 && (
          <div data-testid="step-contact">
            <h2 className="heading-2 mb-4">Seus Dados</h2>
            <Card className="p-4 bg-surface border-border mb-4">
              <p className="text-sm text-zinc-400">Resumo:</p>
              <p className="text-white font-semibold">{selectedService?.name} com {selectedProfessional?.name}</p>
              <p className="text-zinc-400 text-sm">{formatShortDate(selectedDate).weekday}, {new Date(selectedDate + "T12:00:00").getDate()}/{new Date(selectedDate + "T12:00:00").getMonth() + 1} às {selectedSlot?.start}</p>
              <p className="text-primary font-semibold">R$ {selectedService?.price.toFixed(2)}</p>
            </Card>
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Seu Nome *</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} required className="mt-1 bg-surface border-border text-white" placeholder="Nome completo" data-testid="public-client-name" />
              </div>
              <div>
                <Label className="text-zinc-300">Seu Telefone *</Label>
                <Input value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} required className="mt-1 bg-surface border-border text-white" placeholder="(00) 00000-0000" data-testid="public-client-phone" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Button>
              <Button className="flex-1" onClick={handleBook} disabled={booking || !clientName || !clientPhone} data-testid="confirm-booking-button">{booking ? "Agendando..." : "Confirmar Agendamento"}</Button>
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && confirmed && (
          <div className="text-center" data-testid="step-confirmed">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="heading-2 mb-2">Agendamento Confirmado!</h2>
            <Card className="p-6 bg-surface border-border mt-6 text-left">
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-zinc-400">Serviço:</span><span className="text-white font-semibold">{confirmed.service_name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Profissional:</span><span className="text-white font-semibold">{confirmed.professional_name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Data:</span><span className="text-white font-semibold">{confirmed.date}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Horário:</span><span className="text-white font-semibold">{confirmed.start_time} - {confirmed.end_time}</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Valor:</span><span className="text-primary font-semibold">R$ {confirmed.price.toFixed(2)}</span></div>
              </div>
            </Card>
            <div className="mt-4 space-y-3">
              <a
                href={generateWhatsAppLink(
                  info.phone || "",
                  `Olá! Acabei de agendar:\n*${confirmed.service_name}* com *${confirmed.professional_name}*\n*Data:* ${confirmed.date} às ${confirmed.start_time}\nMeu nome: ${confirmed.client_name}\nTelefone: ${confirmed.client_phone}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                data-testid="whatsapp-share-booking"
              >
                <MessageCircle className="w-5 h-5" />
                Enviar Comprovante via WhatsApp
              </a>
              <Button className="w-full" variant="outline" onClick={() => { setStep(0); setConfirmed(null); setSelectedService(null); setSelectedProfessional(null); setSelectedDate(null); setSelectedSlot(null); setClientName(""); setClientPhone(""); }} data-testid="new-booking-button">Fazer Novo Agendamento</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
