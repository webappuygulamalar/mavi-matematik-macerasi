/* Service worker kaydı ve "Uygulamayı Yükle" arayüzü.
 * Buradaki hiçbir hata oyunun açılmasını engellememeli; her şey try/catch içinde. */
(function () {
  "use strict";

  const installButton = document.getElementById("installButton");
  const iosHint = document.getElementById("iosInstallHint");
  let deferredPrompt = null;

  function isStandalone() {
    try {
      return (
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.navigator.standalone === true
      );
    } catch (_) {
      return false;
    }
  }

  function isIos() {
    const ua = navigator.userAgent || "";
    const iPadOs = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
    return /iPad|iPhone|iPod/.test(ua) || iPadOs;
  }

  function refreshInstallUi() {
    const standalone = isStandalone();
    installButton.hidden = standalone || !deferredPrompt;
    // iOS'ta otomatik kurulum istemi yok; Safari için kısa yönerge gösterilir.
    iosHint.hidden = standalone || !isIos();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    refreshInstallUi();
  });

  installButton.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      await promptEvent.prompt();
      await promptEvent.userChoice;
    } catch (_) {
      // Kullanıcı kapattı veya tarayıcı izin vermedi.
    }
    refreshInstallUi();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    refreshInstallUi();
  });

  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", refreshInstallUi);
  } catch (_) {
    // Eski tarayıcılar
  }

  refreshInstallUi();

  // Service worker yalnızca güvenli bağlamda (HTTPS veya localhost) çalışır.
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (new URLSearchParams(window.location.search).get("nosw") === "1") return;
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker kaydedilemedi; oyun çevrimiçi çalışmaya devam ediyor.", error);
    });
  }

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker);
  }
})();
