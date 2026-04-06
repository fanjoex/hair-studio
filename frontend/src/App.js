import { useState, useEffect, createContext, useContext } from "react";
import "@/App.css";
import axios from "axios";
import { Upload, Scissors, Image as ImageIcon, History, Share2, Download, Heart, Globe, Star, X, ChevronLeft, ChevronRight, User, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Get backend URL with proper fallback
const getBackendUrl = () => {
  // Priority 1: Use global variable set in index.html (always works)
  if (window.__BACKEND_URL__) {
    console.log('Using __BACKEND_URL__:', window.__BACKEND_URL__);
    return window.__BACKEND_URL__;
  }
  
  // Priority 2: Try environment variable
  const envUrl = process.env.REACT_APP_BACKEND_URL;
  if (envUrl && envUrl !== 'undefined' && envUrl.startsWith('http')) {
    console.log('Using REACT_APP_BACKEND_URL:', envUrl);
    return envUrl;
  }
  
  // Priority 3: Fallback to current origin (always works)
  console.warn('Using window.location.origin as fallback:', window.location.origin);
  return window.location.origin;
};

const BACKEND_URL = getBackendUrl();
const API = `${BACKEND_URL}/api`;

console.log('=== BACKEND CONFIGURATION ===');
console.log('Backend URL:', BACKEND_URL);
console.log('API URL:', API);
console.log('============================');

axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

const formatApiErrorDetail = (detail) => {
  if (detail == null) return "Algo deu errado. Tente novamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
};

function ErrorBoundary({ children }) {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);

  useEffect(() => {
    const handleError = (error) => {
      console.error('Error caught:', error);
      if (error.message?.includes('undefined') || error.message?.includes('Network')) {
        setHasError(true);
        setErrorInfo(error.message);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full card p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="heading-2 mb-4">Erro de Conexão</h1>
          <p className="body-text mb-6">
            Não foi possível conectar ao servidor. Por favor:
          </p>
          <div className="text-left space-y-2 mb-6">
            <p className="text-sm text-zinc-400">1. Verifique sua conexão com internet</p>
            <p className="text-sm text-zinc-400">2. Limpe o cache do navegador</p>
            <p className="text-sm text-zinc-400">3. Recarregue a página</p>
          </div>
          <Button 
            onClick={() => {
              setHasError(false);
              window.location.reload();
            }}
            className="w-full"
          >
            🔄 Recarregar Página
          </Button>
          {errorInfo && (
            <p className="text-xs text-zinc-600 mt-4 font-mono">{errorInfo}</p>
          )}
        </div>
      </div>
    );
  }

  return children;
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data } = await axios.get(`${API}/auth/me`);
      setUser(data);
    } catch (e) {
      // 401 is expected when not logged in
      if (e.response?.status === 401) {
        setUser(false);
      } else {
        console.error('Auth check error:', e);
        setUser(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/login`, { email, password });
      setUser(data);
      toast.success("Login realizado com sucesso!");
      return true;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  const register = async (name, email, password) => {
    try {
      const { data } = await axios.post(`${API}/auth/register`, { name, email, password });
      setUser(data);
      toast.success("Conta criada com sucesso!");
      return true;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || e.message);
      return false;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`);
      setUser(false);
      toast.success("Logout realizado com sucesso!");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  return useContext(AuthContext);
}

function AuthDialog({ open, onClose }) {
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

function TutorialDialog({ open, onClose }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: "Bem-vindo ao AI Hair & Beard Studio!",
      description: "Experimente diferentes cortes de cabelo e barba usando inteligência artificial. Vamos começar?",
      icon: <Scissors className="w-16 h-16 text-primary" />
    },
    {
      title: "1. Faça Upload da Sua Foto",
      description: "Escolha uma foto clara do seu rosto. Quanto melhor a qualidade, melhor o resultado!",
      icon: <Upload className="w-16 h-16 text-primary" />
    },
    {
      title: "2. Escolha um Estilo",
      description: "Navegue pelos 24 estilos disponíveis de cabelo e barba. Selecione o que mais gosta!",
      icon: <Star className="w-16 h-16 text-primary" />
    },
    {
      title: "3. Gere com IA",
      description: "Clique em 'Gerar com IA' e veja a mágica acontecer. Compare antes e depois com o slider!",
      icon: <ImageIcon className="w-16 h-16 text-primary" />
    },
    {
      title: "4. Compartilhe e Salve",
      description: "Baixe o resultado, compartilhe nas redes sociais ou adicione à galeria pública!",
      icon: <Share2 className="w-16 h-16 text-primary" />
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem("tutorial_completed", "true");
      onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem("tutorial_completed", "true");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border max-w-md">
        <div className="text-center py-6">
          <div className="mb-6 flex justify-center">
            {steps[step].icon}
          </div>
          <h2 className="heading-2 mb-3">{steps[step].title}</h2>
          <p className="body-text mb-6">{steps[step].description}</p>
          <div className="flex gap-2 justify-center mb-4">
            {steps.map((stepItem, i) => (
              <div
                key={`tutorial-step-${i}`}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-8 bg-primary" : "w-2 bg-zinc-700"
                }`}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSkip} className="flex-1">
              Pular
            </Button>
            <Button onClick={handleNext} className="flex-1">
              {step < steps.length - 1 ? "Próximo" : "Começar!"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PublicGallery({ open, onClose }) {
  const [gallery, setGallery] = useState([]);

  useEffect(() => {
    if (open) {
      fetchGallery();
    }
  }, [open]);

  const fetchGallery = async () => {
    try {
      const response = await axios.get(`${API}/gallery/public`);
      setGallery(response.data);
    } catch (e) {
      console.error("Error fetching gallery:", e);
    }
  };

  const handleLike = async (resultId) => {
    try {
      await axios.post(`${API}/result/${resultId}/like`);
      fetchGallery();
    } catch (e) {
      console.error("Error liking:", e);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-surface border-border max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="heading-2 flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            Galeria Pública
          </DialogTitle>
          <DialogDescription className="body-text">
            Veja as transformações criadas pela comunidade
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[500px] pr-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {gallery.length === 0 ? (
              <p className="body-text col-span-full text-center py-8">Nenhuma transformação pública ainda</p>
            ) : (
              gallery.map((item) => (
                <div key={item.id} className="card p-3">
                  <img
                    src={`data:image/png;base64,${item.generated_image}`}
                    alt={item.style_name}
                    className="w-full aspect-square object-cover rounded-lg mb-2"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">{item.style_name}</p>
                    <button
                      onClick={() => handleLike(item.id)}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-primary transition-colors"
                    >
                      <Heart className="w-4 h-4" />
                      {item.likes}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function App() {
  const { user, loading, logout } = useAuth();
  const [uploadedPhoto, setUploadedPhoto] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [styles, setStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [history, setHistory] = useState([]);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  useEffect(() => {
    if (!loading) {
      fetchStyles();
      fetchHistory();
      const tutorialCompleted = localStorage.getItem("tutorial_completed");
      if (!tutorialCompleted) {
        setShowTutorial(true);
      }
    }
  }, [loading]);

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

  // Touch events for mobile
  const handleTouchStart = () => setIsDragging(true);
  const handleTouchEnd = () => setIsDragging(false);
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const x = touch.clientX - rect.left;
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

  const togglePublic = async () => {
    if (!user) {
      toast.error("Faça login para compartilhar publicamente");
      setShowAuthDialog(true);
      return;
    }
    
    if (!generatedResult) return;
    
    try {
      const response = await axios.post(`${API}/result/${generatedResult.id}/public`);
      setGeneratedResult({ ...generatedResult, is_public: response.data.is_public });
      toast.success(response.data.is_public ? "Adicionado à galeria pública!" : "Removido da galeria pública");
    } catch (e) {
      console.error("Error toggling public:", e);
      toast.error("Erro ao atualizar. Tente novamente.");
    }
  };

  const toggleFavorite = async (styleId) => {
    if (!user) {
      toast.error("Faça login para favoritar estilos");
      setShowAuthDialog(true);
      return;
    }
    
    try {
      await axios.post(`${API}/styles/${styleId}/favorite`);
      fetchStyles();
      const { data: updatedUser } = await axios.get(`${API}/auth/me`);
      // Update auth context if needed
    } catch (e) {
      console.error("Error toggling favorite:", e);
    }
  };

  const hairStyles = styles.filter(s => s.category === 'hair');
  const beardStyles = styles.filter(s => s.category === 'beard');

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="body-text">Carregando...</p>
      </div>
    );
  }

  if (!uploadedPhoto) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="p-4 border-b border-border flex justify-between items-center">
          <h1 className="heading-3">AI Hair & Beard Studio</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowGallery(true)} data-testid="open-gallery-button">
              <Globe className="w-4 h-4 mr-2" />
              Galeria
            </Button>
            {user ? (
              <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowAuthDialog(true)} data-testid="login-button">
                <LogIn className="w-4 h-4 mr-2" />
                Entrar
              </Button>
            )}
          </div>
        </header>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h1 className="heading-1 mb-4">AI Hair & Beard Studio</h1>
              <p className="body-text">Experimente diferentes cortes de cabelo e barba usando IA</p>
              {user && (
                <p className="text-primary text-sm mt-2">Bem-vindo, {user.name}!</p>
              )}
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
        
        <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
        <TutorialDialog open={showTutorial} onClose={() => setShowTutorial(false)} />
        <PublicGallery open={showGallery} onClose={() => setShowGallery(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="p-4 border-b border-border flex justify-between items-center">
        <h1 className="heading-3">AI Hair & Beard Studio</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowGallery(true)} data-testid="open-gallery-button">
            <Globe className="w-4 h-4 mr-2" />
            Galeria
          </Button>
          {user ? (
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setShowAuthDialog(true)}>
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          )}
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-8 min-h-[calc(100vh-73px)]">
        <div className="lg:col-span-8 flex flex-col p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="heading-2 mb-2">Transforme Seu Visual</h2>
            <p className="body-text">Selecione um estilo e veja o resultado instantaneamente</p>
          </div>

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
                  <Button 
                    onClick={togglePublic}
                    variant={generatedResult.is_public ? "default" : "secondary"}
                    size="sm"
                    data-testid="toggle-public-button"
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    {generatedResult.is_public ? "Público" : "Tornar Público"}
                  </Button>
                </div>
              </div>
              
              <div 
                className="relative w-full aspect-square max-h-[600px] rounded-xl overflow-hidden touch-none select-none"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                data-testid="before-after-slider"
                style={{ touchAction: 'none' }}
              >
                <img 
                  src={`data:image/png;base64,${generatedResult.generated_image}`}
                  alt="After"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
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
                
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-white/80 cursor-ew-resize touch-none"
                  style={{ left: `${sliderPosition}%` }}
                >
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-zinc-800">
                    <ChevronLeft className="w-5 h-5 text-black absolute left-1" />
                    <ChevronRight className="w-5 h-5 text-black absolute right-1" />
                  </div>
                </div>
                
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Antes
                </div>
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
                  Depois
                </div>
              </div>
            </div>
          ) : uploadedPhoto ? (
            <div className="card flex-1 p-6 mb-6">
              <h3 className="heading-3 mb-4">Sua Foto</h3>
              <div className="w-full max-w-md mx-auto">
                <img 
                  src={uploadedPhoto} 
                  alt="Uploaded" 
                  className="w-full rounded-xl"
                />
              </div>
              <div className="text-center mt-6">
                <p className="body-text">Selecione um estilo ao lado para gerar o resultado</p>
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
                      <div className="flex-1">
                        <p className="font-bold text-sm">{style.name}</p>
                        <p className="text-xs text-zinc-400">{style.description}</p>
                      </div>
                      {user && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(style.id);
                          }}
                          className="ml-2"
                        >
                          <Star 
                            className={`w-4 h-4 ${
                              user.favorites?.includes(style.id) ? 'fill-primary text-primary' : 'text-zinc-400'
                            }`}
                          />
                        </button>
                      )}
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
                      <div className="flex-1">
                        <p className="font-bold text-sm">{style.name}</p>
                        <p className="text-xs text-zinc-400">{style.description}</p>
                      </div>
                      {user && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(style.id);
                          }}
                          className="ml-2"
                        >
                          <Star 
                            className={`w-4 h-4 ${
                              user.favorites?.includes(style.id) ? 'fill-primary text-primary' : 'text-zinc-400'
                            }`}
                          />
                        </button>
                      )}
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
      
      <AuthDialog open={showAuthDialog} onClose={() => setShowAuthDialog(false)} />
      <PublicGallery open={showGallery} onClose={() => setShowGallery(false)} />
    </div>
  );
}

function AppWithAuth() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default AppWithAuth;