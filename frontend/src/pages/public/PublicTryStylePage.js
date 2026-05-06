import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, Camera, ArrowLeft, Download, Scissors, Image as ImageIcon, Coins, UserPlus } from "lucide-react";
import { toast, Toaster } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { AffiliateBanner } from "@/components/AffiliateBanner";
import PaymentQR from "@/components/PaymentQR";
import "@/App.css";

const BACKEND_URL = window.__BACKEND_URL__ || window.location.origin;
const API = `${BACKEND_URL}/api`;

const CATEGORY_LABELS = { haircut: "Cabelo", beard: "Barba", combo: "Combo" };

export default function PublicTryStylePage({ kioskMode = false }) {
  const { barbershopId } = useParams();
  const inactivityTimerRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [credits, setCredits] = useState(3); // Start with 3 free uses
  const [showPayment, setShowPayment] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    loadInfo();
  }, [barbershopId]);

  // Reset state to initial (used by kiosk mode auto-reset)
  const resetAll = useCallback(() => {
    setPhoto(null);
    setPhotoBase64(null);
    setSelectedStyle(null);
    setResult(null);
    setGenerating(false);
  }, []);

  // Kiosk mode: auto reset after 60s of inactivity on result, 90s elsewhere
  useEffect(() => {
    if (!kioskMode) return;
    const RESET_MS = result ? 60000 : 90000;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      resetAll();
    }, RESET_MS);
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [kioskMode, photo, result, selectedStyle, resetAll]);

  const loadInfo = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/public/barbershop/${barbershopId}/styles`);
      setInfo(data);
    } catch (e) {
      toast.error("Barbearia não encontrada");
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result);
      const b64 = reader.result.split(",")[1];
      setPhotoBase64(b64);
    };
    reader.readAsDataURL(file);
  };

  const openCamera = useCallback(async () => {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        streamRef.current = stream;
        setShowCamera(true);
        setTimeout(() => {
          if (videoRef.current) videoRef.current.srcObject = stream;
        }, 100);
        return;
      }
    } catch (e) {
      console.warn("getUserMedia failed, using fallback");
    }
    if (cameraInputRef.current) cameraInputRef.current.click();
  }, []);

  const closeCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(videoRef.current, 0, 0);
    closeCamera();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(dataUrl);
    setPhotoBase64(dataUrl.split(",")[1]);
    toast.success("Foto capturada!");
  }, [closeCamera]);

  const handleGenerate = async () => {
    if (!photoBase64 || !selectedStyle) return;
    
    // Check credits
    if (credits <= 0) {
      setShowPayment(true);
      return;
    }
    
    setGenerating(true);
    setResult(null);
    try {
      const { data } = await axios.post(`${API}/public/barbershop/${barbershopId}/try-style`, {
        photo_base64: photoBase64,
        style_id: selectedStyle.id,
      });
      setResult(data);
      setCredits(c => c - 1); // Decrement credit
      toast.success("Estilo aplicado!");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Erro ao gerar estilo");
    } finally {
      setGenerating(false);
    }
  };

  const handlePaymentSuccess = (uses) => {
    setCredits(uses);
    setShowPayment(false);
    toast.success(`${uses} créditos adicionados!`);
  };

  const downloadResult = () => {
    if (!result?.generated_image) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${result.generated_image}`;
    link.download = `${result.style_name || "estilo"}.png`;
    link.click();
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
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" richColors />

      <header className="bg-surface border-b border-border p-4 text-center">
        <h1 className="text-2xl font-bold text-gold" data-testid="public-barbershop-name">{info.barbershop_name}</h1>
        <p className="text-sm text-zinc-400 mt-1">Experimente nossos estilos de corte com IA</p>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {/* Step 1: Upload photo */}
        {!photo && (
          <div data-testid="upload-step">
            <h2 className="heading-2 text-gold text-center mb-6">Envie sua foto</h2>
            <div className="upload-options">
              <label className="upload-option" data-testid="public-upload-photo">
                <Upload className="w-12 h-12" />
                <h3 className="text-gold font-bold text-lg mb-1">Enviar Foto</h3>
                <p className="text-sm text-zinc-400">Da galeria</p>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <label className="upload-option" onClick={(e) => { e.preventDefault(); openCamera(); }} data-testid="public-camera">
                <Camera className="w-12 h-12" />
                <h3 className="text-gold font-bold text-lg mb-1">Tirar Foto</h3>
                <p className="text-sm text-zinc-400">Usar câmera</p>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
            <div className="mt-8 px-4 max-w-4xl mx-auto w-full">
              {barbershopId && (
                <Card className="bg-surface border-border p-5 mb-6 flex flex-col sm:flex-row items-center gap-5">
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <QRCodeSVG
                      value={`${window.location.origin}/cliente/registrar?b=${barbershopId}`}
                      size={140}
                      level="H"
                      includeMargin={false}
                    />
                  </div>
                  <div className="flex-1 text-center sm:text-left">
                    <h3 className="text-gold font-bold text-lg flex items-center justify-center sm:justify-start gap-2 mb-1">
                      <UserPlus className="w-5 h-5" />
                      Seja cliente da {info?.barbershop_name || "barbearia"}
                    </h3>
                    <p className="text-sm text-zinc-400 mb-2">
                      Escaneie o QR Code com seu celular para criar sua conta e acessar seus resultados, agendamentos e descontos exclusivos.
                    </p>
                    <p className="text-xs text-zinc-500">Ou acesse: <span className="text-primary">{window.location.origin}/cliente/registrar?b={barbershopId.slice(0, 8)}...</span></p>
                  </div>
                </Card>
              )}
              <AffiliateBanner barbershopId={barbershopId} />
            </div>
          </div>
        )}

        {/* Step 2: Select style + generate */}
        {photo && !result && (
          <div data-testid="style-step">
            <div className="flex items-center gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={() => { setPhoto(null); setPhotoBase64(null); setSelectedStyle(null); }}>
                <ArrowLeft className="w-4 h-4 mr-1" />Nova Foto
              </Button>
              <h2 className="heading-2 text-gold">Escolha o Estilo</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Photo preview */}
              <div>
                <Card className="overflow-hidden bg-surface border-border">
                  <div className="style-image-container">
                    <img src={photo} alt="Sua foto" className="w-full h-full object-cover" />
                  </div>
                  <div className="p-2 text-center text-sm text-zinc-400">Sua foto</div>
                </Card>
              </div>

              {/* Styles grid */}
              <div className="md:col-span-2">
                {info.styles.length === 0 ? (
                  <Card className="p-8 bg-surface border-border text-center">
                    <p className="body-text">Esta barbearia ainda não cadastrou estilos.</p>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
                      {info.styles.map((style) => (
                        <Card
                          key={style.id}
                          onClick={() => setSelectedStyle(style)}
                          className={`cursor-pointer bg-surface transition-all ${selectedStyle?.id === style.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-zinc-600"}`}
                          data-testid={`public-style-card-${style.id}`}
                        >
                          <div className="style-image-container">
                            {style.has_image ? (
                              <img src={`${API}/public/style-image/${style.id}`} alt={style.name} className="w-full h-full object-cover" />
                            ) : (
                              <Scissors className="w-8 h-8 text-zinc-700" />
                            )}
                          </div>
                          <div className="p-2">
                            <p className="text-sm font-semibold text-white truncate">{style.name}</p>
                            <Badge className="text-[10px] bg-zinc-800 text-zinc-400 border-zinc-700 border mt-1">{CATEGORY_LABELS[style.category] || style.category}</Badge>
                          </div>
                        </Card>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <Coins className="w-4 h-4 text-gold" />
                        <span>Créditos: <span className={credits > 0 ? "text-green-400" : "text-red-400"}>{credits}</span></span>
                      </div>
                      {credits <= 0 && (
                        <button onClick={() => setShowPayment(true)} className="text-xs text-primary hover:underline">
                          Comprar créditos
                        </button>
                      )}
                    </div>
                    <Button
                      onClick={handleGenerate}
                      disabled={!selectedStyle || generating}
                      className="btn-gold w-full text-lg py-6"
                      data-testid="public-generate-button"
                    >
                      <Scissors className="w-5 h-5 mr-2" />
                      {generating ? "Gerando com IA..." : credits > 0 ? "Experimentar Estilo" : "Comprar Créditos"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Generating */}
        {generating && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gold text-lg font-semibold">Aplicando estilo com IA...</p>
            <p className="text-sm text-zinc-400 mt-1">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* Step 3: Result */}
        {result && (
          <div data-testid="result-step">
            <h2 className="heading-2 text-gold text-center mb-6">Resultado: {result.style_name}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <Card className="overflow-hidden bg-surface border-border">
                <img src={photo} alt="Original" className="w-full aspect-square object-cover" />
                <div className="p-3 text-center text-sm text-zinc-400">Antes</div>
              </Card>
              <Card className="overflow-hidden bg-surface border-border">
                <img src={`data:image/png;base64,${result.generated_image}`} alt="Resultado" className="w-full aspect-square object-cover" />
                <div className="p-3 text-center text-sm text-zinc-400">Depois — {result.style_name}</div>
              </Card>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6 max-w-md mx-auto">
              <Button onClick={downloadResult} className="btn-gold flex-1" data-testid="download-result">
                <Download className="w-4 h-4 mr-2" />Baixar Resultado
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setSelectedStyle(null); }} data-testid="try-another">
                Tentar Outro Estilo
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setResult(null); setPhoto(null); setPhotoBase64(null); setSelectedStyle(null); }}>
                Nova Foto
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {showPayment && (
        <PaymentQR 
          onClose={() => setShowPayment(false)} 
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-4">
            <h3 className="text-gold font-bold text-lg">Tirar Foto</h3>
            <Button variant="ghost" size="sm" onClick={closeCamera} className="text-white">Fechar</Button>
          </div>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-contain" style={{ transform: "scaleX(-1)" }} />
          </div>
          <div className="p-6 flex justify-center">
            <button onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center" data-testid="public-capture-button">
              <div className="w-14 h-14 rounded-full bg-white"></div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
