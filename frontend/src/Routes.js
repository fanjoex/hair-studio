import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthDialog } from "@/components/AuthDialog";
import "@/App.css";

// Pages Master
import { MasterLayout } from "@/pages/master/MasterLayout";
import { MasterDashboard } from "@/pages/master/Dashboard";
import { BarbershopsList } from "@/pages/master/BarbershopsList";
import { BarbershopForm } from "@/pages/master/BarbershopForm";
import { AdvertisementsPage } from "@/pages/master/AdvertisementsPage";
import { AdminSettingsPage } from "@/pages/master/AdminSettingsPage";

// Pages Barbershop
import { BarbershopLayout } from "@/pages/barbershop/BarbershopLayout";
import { BarbershopDashboard } from "@/pages/barbershop/BarbershopDashboard";
import { ClientsList } from "@/pages/barbershop/ClientsList";
import { ServicesList } from "@/pages/barbershop/ServicesList";
import { ProfessionalsList } from "@/pages/barbershop/ProfessionalsList";
import { AgendaPage } from "@/pages/barbershop/AgendaPage";
import { SettingsPage } from "@/pages/barbershop/SettingsPage";
import { StylesPage } from "@/pages/barbershop/StylesPage";
import { BarbershopAdvertisementsPage } from "@/pages/barbershop/BarbershopAdvertisementsPage";
import PaymentPage from "@/pages/barbershop/PaymentPage";

// Public Pages
import PublicBookingPage from "@/pages/public/PublicBookingPage";
import PublicTryStylePage from "@/pages/public/PublicTryStylePage";

// Client pages
import { ClientDashboard } from "@/pages/client/ClientDashboard";
import { ClientRegister } from "@/pages/client/ClientRegister";

// App Original
import HairBarbApp from "@/App";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

function LoginPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [installable, setInstallable] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e) => setInstallable(!!e.detail);
    window.addEventListener("pwa-installable", handler);
    if (typeof window.__isPwaInstallable === "function") {
      setInstallable(window.__isPwaInstallable());
    }
    return () => window.removeEventListener("pwa-installable", handler);
  }, []);

  const handleInstall = async () => {
    if (typeof window.__installPwa === "function") {
      await window.__installPwa();
    }
  };

  useEffect(() => {
    if (!loading && user) {
      if (user.role === "master_admin") {
        navigate("/master", { replace: true });
      } else if (user.role === "barbershop_owner" || user.role === "barbershop_staff") {
        navigate("/barbershop", { replace: true });
      } else if (user.role === "client") {
        navigate("/cliente", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <h1 className="heading-1 text-gold mb-4" data-testid="login-title">AI Hair & Beard Studio</h1>
        <p className="body-text mb-8">Sistema de Gerenciamento de Barbearias</p>
        
        <div className="space-y-4">
          <button
            onClick={() => setShowAuth(true)}
            className="btn-gold w-full px-6 py-4 rounded-lg text-lg"
            data-testid="open-login-dialog-button"
          >
            Entrar no Sistema
          </button>

          <button
            onClick={() => navigate("/cliente/registrar")}
            className="w-full px-6 py-3 rounded-lg text-sm font-medium border border-amber-600/30 text-amber-400 hover:bg-amber-600/10 transition-colors"
            data-testid="client-register-link"
          >
            Sou cliente — criar conta
          </button>

          {installable && (
            <button
              onClick={handleInstall}
              className="w-full px-6 py-3 rounded-lg text-sm font-medium bg-amber-500/10 border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 transition-colors flex items-center justify-center gap-2"
              data-testid="install-pwa-button"
            >
              📲 Instalar Aplicativo
            </button>
          )}
        </div>

        <p className="text-xs text-zinc-600 mt-8">
          Para experimentar cortes com IA, acesse o link da sua barbearia
          (formato <span className="text-zinc-400">/experimentar/&lt;id&gt;</span>).
        </p>
        
        <AuthDialog open={showAuth} onClose={() => setShowAuth(false)} />
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Master Admin Routes */}
          <Route element={<ProtectedRoute allowedRoles={["master_admin"]} />}>
            <Route path="/master" element={<MasterLayout />}>
              <Route index element={<MasterDashboard />} />
              <Route path="barbershops" element={<BarbershopsList />} />
              <Route path="barbershops/new" element={<BarbershopForm />} />
              <Route path="barbershops/:id/edit" element={<BarbershopForm />} />
              <Route path="advertisements" element={<AdvertisementsPage />} />
              <Route path="settings" element={<AdminSettingsPage />} />
            </Route>
          </Route>

          {/* Barbershop Owner/Staff Routes */}
          <Route element={<ProtectedRoute allowedRoles={["barbershop_owner", "barbershop_staff"]} />}>
            <Route path="/barbershop" element={<BarbershopLayout />}>
              <Route index element={<BarbershopDashboard />} />
              <Route path="clients" element={<ClientsList />} />
              <Route path="services" element={<ServicesList />} />
              <Route path="professionals" element={<ProfessionalsList />} />
              <Route path="agenda" element={<AgendaPage />} />
              <Route path="styles" element={<StylesPage />} />
              <Route path="advertisements" element={<BarbershopAdvertisementsPage />} />
              <Route path="payments" element={<PaymentPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Client Routes */}
          <Route path="/cliente/registrar" element={<ClientRegister />} />
          <Route element={<ProtectedRoute allowedRoles={["client"]} />}>
            <Route path="/cliente" element={<ClientDashboard />} />
          </Route>

          {/* Public Booking Page (No auth required) */}
          <Route path="/agendar/:barbershopId" element={<PublicBookingPage />} />

          {/* Public Try Style Page (No auth required) */}
          <Route path="/experimentar/:barbershopId" element={<PublicTryStylePage />} />
          <Route path="/totem/:barbershopId" element={<PublicTryStylePage kioskMode />} />

          {/* App Original - Hair & Beard Studio */}
          <Route path="/app" element={<HairBarbApp />} />

          {/* Redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default AppRoutes;
