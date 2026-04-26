/**
 * Registro do Service Worker e prompt de instalação PWA.
 * Em desenvolvimento (localhost), o SW é desativado para evitar cache agressivo.
 */

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  // Em desenvolvimento (CRA dev server) podemos pular para nao cachear
  const isDev = window.location.hostname === "localhost" && window.location.port === "3000";
  if (isDev) {
    // Desregistra qualquer SW antigo para evitar problema de cache
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // Nova versão disponível
              if (window.confirm("Nova versão disponível. Atualizar?")) {
                installing.postMessage("SKIP_WAITING");
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((err) => console.warn("SW registration failed:", err));
  });
}

/**
 * Captura o evento beforeinstallprompt e expoe um trigger global window.__installPwa()
 * para que qualquer componente possa chamar para mostrar o prompt nativo.
 */
export function setupInstallPrompt() {
  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: true }));
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: false }));
  });

  window.__installPwa = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent("pwa-installable", { detail: false }));
    return outcome === "accepted";
  };

  window.__isPwaInstallable = () => !!deferredPrompt;
}
