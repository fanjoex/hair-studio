import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, ShoppingBag, X } from "lucide-react";

// Configuração de produtos afiliados
const AFFILIATE_PRODUCTS = [
  {
    id: 1,
    name: "Pomada Modeladora Matte",
    brand: "American Crew",
    price: "R$ 89,90",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23E4A853'%3E%3Crect width='200' height='200' fill='%2318181b'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E4A853' font-size='14'%3EPomada%3C/text%3E%3Ctext x='100' y='110' text-anchor='middle' fill='%23a1a1aa' font-size='12'%3EAmerican Crew%3C/text%3E%3Ctext x='100' y='130' text-anchor='middle' fill='%23a1a1aa' font-size='11'%3ER$ 89,90%3C/text%3E%3C/svg%3E",
    affiliateUrl: "https://amzn.to/3ABC123", // Substitua pelo seu link real
    description: "Fixação forte, acabamento natural"
  },
  {
    id: 2,
    name: "Shampoo Antiqueda",
    brand: "Boticário",
    price: "R$ 45,90",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23E4A853'%3E%3Crect width='200' height='200' fill='%2318181b'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E4A853' font-size='14'%3EShampoo%3C/text%3E%3Ctext x='100' y='110' text-anchor='middle' fill='%23a1a1aa' font-size='12'%3EBoticário%3C/text%3E%3Ctext x='100' y='130' text-anchor='middle' fill='%23a1a1aa' font-size='11'%3ER$ 45,90%3C/text%3E%3C/svg%3E",
    affiliateUrl: "https://amzn.to/3DEF456",
    description: "Fortalece e dá volume"
  },
  {
    id: 3,
    name: "Kit Barbeador Elétrico",
    brand: "Wahl",
    price: "R$ 249,90",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23E4A853'%3E%3Crect width='200' height='200' fill='%2318181b'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E4A853' font-size='14'%3EBarbeador%3C/text%3E%3Ctext x='100' y='110' text-anchor='middle' fill='%23a1a1aa' font-size='12'%3EWahl%3C/text%3E%3Ctext x='100' y='130' text-anchor='middle' fill='%23a1a1aa' font-size='11'%3ER$ 249,90%3C/text%3E%3C/svg%3E",
    affiliateUrl: "https://amzn.to/3GHI789",
    description: "Precisão profissional em casa"
  },
  {
    id: 4,
    name: "Óleo para Barba",
    brand: "Balm",
    price: "R$ 39,90",
    image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' fill='%23E4A853'%3E%3Crect width='200' height='200' fill='%2318181b'/%3E%3Ctext x='100' y='90' text-anchor='middle' fill='%23E4A853' font-size='14'%3EÓleo Barba%3C/text%3E%3Ctext x='100' y='110' text-anchor='middle' fill='%23a1a1aa' font-size='12'%3EBalm%3C/text%3E%3Ctext x='100' y='130' text-anchor='middle' fill='%23a1a1aa' font-size='11'%3ER$ 39,90%3C/text%3E%3C/svg%3E",
    affiliateUrl: "https://amzn.to/3JKL012",
    description: "Hidratação e brilho natural"
  }
];

export function AffiliateBanner() {
  const [showQR, setShowQR] = useState(null);

  return (
    <div className="mt-8">
      <h3 className="text-gold text-center mb-4 flex items-center justify-center gap-2">
        <ShoppingBag className="w-5 h-5" />
        Produtos para Manter Seu Estilo
      </h3>
      <p className="text-sm text-zinc-400 text-center mb-4">
        Escaneie o QR Code para comprar com desconto
      </p>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {AFFILIATE_PRODUCTS.map((product) => (
          <Card key={product.id} className="bg-surface border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-all" onClick={() => setShowQR(product)}>
            <div className="aspect-square bg-zinc-900 flex items-center justify-center">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-contain p-2"
                onError={(e) => {
                  e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' fill='%23E4A853'%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em'%3EProduto%3C/text%3E%3C/svg%3E";
                }}
              />
            </div>
            <div className="p-2 text-center">
              <p className="text-xs font-semibold text-white truncate">{product.name}</p>
              <p className="text-xs text-primary">{product.price}</p>
              <p className="text-[10px] text-zinc-500 truncate">{product.brand}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* QR Code Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setShowQR(null)}>
          <Card className="bg-surface border-primary p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-gold font-bold">{showQR.name}</h4>
              <Button variant="ghost" size="sm" onClick={() => setShowQR(null)}><X className="w-4 h-4" /></Button>
            </div>
            <p className="text-sm text-zinc-400 mb-4">{showQR.description}</p>
            <div className="bg-white p-4 rounded-lg flex justify-center mb-4">
              <QRCodeSVG 
                value={showQR.affiliateUrl} 
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className="text-xs text-zinc-500 text-center mb-4">
              Escaneie com a câmera do celular
            </p>
            <a 
              href={showQR.affiliateUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-gold w-full py-3 rounded-lg flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Ver na Loja
            </a>
          </Card>
        </div>
      )}
    </div>
  );
}

export default AffiliateBanner;
