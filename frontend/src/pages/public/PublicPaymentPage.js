import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle, Clock, XCircle, Copy, Check } from "lucide-react";

const API = (window.__BACKEND_URL__ || window.location.origin) + "/api";

export default function PublicPaymentPage() {
  const { chargeId } = useParams();
  const [charge, setCharge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadCharge();
    // Poll a cada 4s enquanto pendente
    const interval = setInterval(() => {
      setCharge(prev => {
        if (prev?.status === "pending") loadCharge();
        return prev;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [chargeId]);

  const loadCharge = async () => {
    try {
      const res = await axios.get(`${API}/payment/public/charge/${chargeId}`);
      setCharge(res.data);
    } catch {
      setCharge(null);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = () => {
    if (!charge?.qr_code) return;
    navigator.clipboard.writeText(charge.qr_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!charge) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-white mb-2">Cobrança não encontrada</h2>
          <p className="text-zinc-400 text-sm">Este link é inválido ou expirou.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 mb-4">
            <span className="text-amber-500 font-bold text-xs tracking-widest uppercase">Pix</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{charge.description}</h1>
          <p className="text-4xl font-extrabold text-amber-400 mt-2">R$ {charge.total?.toFixed(2)}</p>
        </div>

        {/* Status */}
        {charge.status === "paid" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center mb-6">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-green-400 text-lg font-bold">Pagamento confirmado!</p>
            <p className="text-zinc-400 text-sm mt-1">Obrigado!</p>
          </div>
        )}

        {charge.status === "cancelled" && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center mb-6">
            <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 text-lg font-bold">Cobrança cancelada</p>
          </div>
        )}

        {charge.status === "pending" && charge.qr_code && (
          <>
            {/* QR Code */}
            <div className="bg-white rounded-2xl p-5 flex items-center justify-center mb-5 shadow-xl">
              <QRCodeSVG value={charge.qr_code} size={240} level="H" />
            </div>

            {/* Instruções */}
            <p className="text-zinc-400 text-sm text-center mb-4">
              Abra o app do seu banco → Pix → <strong className="text-white">Ler QR Code</strong> ou use o código abaixo
            </p>

            {/* Copiar código */}
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 mb-4">
              <p className="text-zinc-500 text-xs mb-2">Pix Copia e Cola</p>
              <div className="flex items-start gap-2">
                <p className="text-zinc-300 text-xs break-all flex-1 leading-relaxed select-all">{charge.qr_code}</p>
              </div>
            </div>

            <button
              onClick={copyCode}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-base transition-all ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-amber-500 hover:bg-amber-400 text-black"
              }`}
            >
              {copied ? (
                <><Check className="w-5 h-5" /> Código copiado!</>
              ) : (
                <><Copy className="w-5 h-5" /> Copiar código Pix</>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-5 text-amber-500 text-sm animate-pulse">
              <Clock className="w-4 h-4" />
              Aguardando pagamento...
            </div>
          </>
        )}
      </div>
    </div>
  );
}
