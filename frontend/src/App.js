import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Upload, Scissors, Image as ImageIcon, History, Share2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [styles, setStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetchStyles();
    fetchHistory();
  }, []);

  const fetchStyles = async () => {
    try {
      const response = await axios.get(`${API}/styles`);
      setStyles(response.data);
    } catch (e) {
      console.error("Error fetching styles:", e);
      toast.error("Erro ao carregar estilos");
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API}/history`);
      setHistory(response.data);
    } catch (e) {
      console.error("Error fetching history:", e);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(`${API}/upload-photo`, formData);
      setPhotoId(response.data.photo_id);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedPhoto(reader.result);
      };
      reader.readAsDataURL(file);
      
      toast.success("Foto carregada com sucesso!");
    } catch (e) {
      console.error("Error uploading photo:", e);
      toast.error("Erro ao fazer upload da foto");
    }
  };

  const handleGenerate = async () => {
    if (!photoId || !selectedStyle) {
      toast.error("Selecione uma foto e um estilo");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await axios.post(`${API}/generate`, {
        photo_id: photoId,
        style_id: selectedStyle.id
      });
      
      setGeneratedResult(response.data);
      toast.success("Estilo aplicado com sucesso!");
      fetchHistory();
    } catch (e) {
      console.error("Error generating:", e);
      toast.error("Erro ao gerar estilo. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, percentage)));
  };

  const handleShare = async () => {
    if (!generatedResult) return;
    
    const imageData = `data:image/png;base64,${generatedResult.generated_image}`;
    
    try {
      const blob = await (await fetch(imageData)).blob();
      const file = new File([blob], "haircut-style.png", { type: "image/png" });
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Meu novo visual",
          text: `Experimente este estilo: ${generatedResult.style_name}`
        });
      } else {
        toast.info("Compartilhamento não disponível neste navegador");
      }
    } catch (e) {
      console.error("Error sharing:", e);
    }
  };

  const handleDownload = () => {
    if (!generatedResult) return;
    
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${generatedResult.generated_image}`;
    link.download = `haircut-${generatedResult.style_name}.png`;
    link.click();
    toast.success("Imagem baixada!");
  };

  const hairStyles = styles.filter(s => s.category === 'hair');
  const beardStyles = styles.filter(s => s.category === 'beard');

  if (!uploadedPhoto) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <h1 className="heading-1 mb-4">AI Hair & Beard Studio</h1>
            <p className="body-text">Experimente diferentes cortes de cabelo e barba usando IA</p>
          </div>
          
          <label 
            htmlFor="photo-upload" 
            className="upload-zone"
            data-testid="upload-photo-zone"
          >
            <Upload className="w-16 h-16 text-primary mb-4" />
            <h3 className="heading-3 mb-2">Faça upload da sua foto</h3>
            <p className="body-text">Arraste ou clique para selecionar</p>
            <input 
              id="photo-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 h-screen">
        {/* Main Workspace */}
        <div className="lg:col-span-8 flex flex-col p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="heading-2 mb-2">Transforme Seu Visual</h1>
            <p className="body-text">Selecione um estilo e veja o resultado instantaneamente</p>
          </div>

          {/* Before/After Viewer */}
          {generatedResult ? (
            <div className="card flex-1 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="heading-3">Antes & Depois</h3>
                <div className="flex gap-2">
                  <Button 
                    onClick={handleDownload}
                    variant="secondary"
                    size="sm"
                    data-testid="download-result-button"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Baixar
                  </Button>
                  <Button 
                    onClick={handleShare}
                    variant="secondary"
                    size="sm"
                    data-testid="share-social-button"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Compartilhar
                  </Button>
                </div>
              </div>
              
              <div 
                className="relative w-full aspect-square max-h-[600px] rounded-xl overflow-hidden"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                data-testid="before-after-slider"
              >
                {/* After Image */}
                <img 
                  src={`data:image/png;base64,${generatedResult.generated_image}`}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Before Image with clip */}
                <div 
                  className="absolute inset-0 overflow-hidden"
                  style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                >
                  <img 
                    src={`data:image/png;base64,${generatedResult.original_image}`}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Slider Handle */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white/80 cursor-ew-resize"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <ChevronLeft className="w-4 h-4 text-black absolute left-0" />
                    <ChevronRight className="w-4 h-4 text-black absolute right-0" />
                  </div>
                </div>
                
                {/* Labels */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Antes
                </div>
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Depois
                </div>
              </div>
            </div>
          ) : (
            <div className="card flex-1 p-6 mb-6 flex items-center justify-center">
              <div className="text-center">
                <ImageIcon className="w-16 h-16 text-muted mx-auto mb-4" />
                <p className="body-text">Selecione um estilo para gerar o resultado</p>
              </div>
            </div>
          )}

          {/* History Section */}
          <div className="card p-6">
            <h3 className="heading-3 mb-4" data-testid="history-gallery">Histórico</h3>
            <ScrollArea className="h-32">
              <div className="flex gap-4">
                {history.length === 0 ? (
                  <p className="body-text">Nenhum estilo gerado ainda</p>
                ) : (
                  history.map((item) => (
                    <div 
                      key={item.id}
                      className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden border-2 border-transparent hover:border-primary cursor-pointer transition-all"
                      onClick={() => setGeneratedResult(item)}
                    >
                      <img 
                        src={`data:image/png;base64,${item.generated_image}`}
                        alt={item.style_name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Sidebar Style Selector */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-border p-6 lg:p-8 overflow-y-auto">
          <h3 className="heading-3 mb-4">Escolha um Estilo</h3>
          
          <Tabs defaultValue="hair" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="hair">Cabelo</TabsTrigger>
              <TabsTrigger value="beard">Barba</TabsTrigger>
            </TabsList>
            
            <TabsContent value="hair">
              <div className="grid grid-cols-2 gap-4" data-testid="hair-style-grid">
                {hairStyles.map((style) => (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`style-item ${
                      selectedStyle?.id === style.id ? 'active' : ''
                    }`}
                  >
                    {style.image_url ? (
                      <img 
                        src={style.image_url} 
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <Scissors className="w-8 h-8 text-muted" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                      <div>
                        <p className="font-bold text-sm">{style.name}</p>
                        <p className="text-xs text-zinc-400">{style.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="beard">
              <div className="grid grid-cols-2 gap-4" data-testid="beard-style-grid">
                {beardStyles.map((style) => (
                  <div
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`style-item ${
                      selectedStyle?.id === style.id ? 'active' : ''
                    }`}
                  >
                    {style.image_url ? (
                      <img 
                        src={style.image_url} 
                        alt={style.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-surface flex items-center justify-center">
                        <Scissors className="w-8 h-8 text-muted" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-3">
                      <div>
                        <p className="font-bold text-sm">{style.name}</p>
                        <p className="text-xs text-zinc-400">{style.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          <Button 
            onClick={handleGenerate}
            disabled={!selectedStyle || isGenerating}
            className="w-full mt-6"
            size="lg"
            data-testid="generate-ai-button"
          >
            {isGenerating ? "Gerando..." : "Gerar com IA"}
          </Button>

          <Button 
            onClick={() => {
              setUploadedPhoto(null);
              setPhotoId(null);
              setSelectedStyle(null);
              setGeneratedResult(null);
            }}
            variant="outline"
            className="w-full mt-3"
          >
            Nova Foto
          </Button>
        </div>
      </div>
    </div>
  );
}

export default App;