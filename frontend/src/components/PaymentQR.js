import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Clock, CheckCircle } from "lucide-react";

const PACKAGES = [
  { id: 1, uses: 1, price: 4.90, label: "1 Teste" },
  { id: 2, uses: 5, price: 19.90, label: "5 Testes", popular: true },
  { id: 3, uses: 10, price: 34.90, label: "10 Testes" }
];

export function PaymentQR({ onClose, onSuccess, packageId = 2 }) {
  const [selectedPackage, setSelectedPackage] = useState(PACKAGES.find(p => p.id === packageId) || PACKAGES[1]);
  const [pixCode, setPixCode] = useState("");
  const [status, setStatus] = useState("selecting"); // selecting, waiting, paid
  const [timeLeft, setTimeLeft] = useState(300); // 5 minutes

  useEffect(() => {
    if (status === "waiting" && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [status, timeLeft]);

  const generatePix = () => {
    // Em produção, chamar backend para gerar PIX real
    const mockPixCode = `00020126580014br.gov.bcb.pix0136emlstudio@email.com520400005303986540${selectedPackage.price.toFixed(2).replace('.', '')}5802BR5913EML STUDIO6008CURITIBA62070503***6304`;
    setPixCode(mockPixCode);
    setStatus("waiting");
    
    // Simular pagamento em 5 segundos (remover em produção)
    setTimeout(() => {
      setStatus("paid");
      setTimeout(() => onSuccess(selectedPackage.uses), 1500);
    }, 5000);
  };

  const copyPixCode = () => {
    navigator.clipboard.writeText(pixCode);
    alert("Código PIX copiado!");
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
      <Card className="bg-surface border-primary max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-gold text-xl font-bold">Adquirir Créditos</h3>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="w-5 h-5" /></Button>
        </div>

        {status === "selecting" && (
          <>
            <p className="text-zinc-400 text-sm mb-4 text-center">
              Escolha um pacote para continuar usando a IA
            </p>
            <div className="space-y-3 mb-6">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedPackage.id === pkg.id 
                      ? "border-primary bg-primary/10" 
                      : "border-zinc-700 hover:border-zinc-600"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-white">{pkg.label}</p>
                      <p className="text-sm text-zinc-500">{pkg.uses} {pkg.uses === 1 ? 'teste' : 'testes'} de corte IA</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-gold">R$ {pkg.price.toFixed(2).replace('.', ',')}</p>
                      {pkg.popular && (
                        <span className="text-[10px] bg-primary text-black px-2 py-0.5 rounded-full">POPULAR</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button onClick={generatePix} className="btn-gold w-full py-4">
              Gerar QR Code PIX
            </Button>
          </>
        )}

        {status === "waiting" && (
          <>
            <div className="text-center mb-4">
              <div className="bg-white p-4 rounded-lg inline-block mb-4">
                <QRCodeSVG 
                  value={pixCode} 
                  size={220}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="text-sm text-zinc-400 mb-2">
                Escaneie com seu banco
              </p>
              <div className="flex items-center justify-center gap-2 text-gold">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatTime(timeLeft)}</span>
              </div>
            </div>
            <div className="bg-zinc-900 p-3 rounded-lg mb-4">
              <p className="text-xs text-zinc-500 mb-1">Ou copie o código PIX:</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs text-zinc-400 truncate">{pixCode}</code>
                <Button size="sm" variant="outline" onClick={copyPixCode}>Copiar</Button>
              </div>
            </div>
            <p className="text-xs text-zinc-500 text-center">
              Após o pagamento, os créditos serão adicionados automaticamente
            </p>
          </>
        )}

        {status === "paid" && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-xl font-bold text-white mb-2">Pagamento Confirmado!</h4>
            <p className="text-zinc-400">+{selectedPackage.uses} créditos adicionados</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export default PaymentQR;
