/* Service worker kaydı, kurulum arayüzü ve güncelleme bildirimi.
 * Buradaki hiçbir hata oyunun açılmasını engellememeli; her şey try/catch içinde. */
(function () {
  "use strict";

  const installButton = document.getElementById("installButton");
  const installHelpButton = document.getElementById("installHelpButton");
  const stepAndroid = document.getElementById("installStepAndroid");
  const stepIos = document.getElementById("installStepIos");
  const updateBanners = Array.from(document.querySelectorAll("[data-update-banner]"));
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

  // Kurulu (standalone) çalışırken hiçbiri görünmez. Gerçek kurulum istemi varsa "Uygulamayı Yükle",
  // yoksa yalnızca adım adım "Kurulum Yardımı" gösterilir (sahte başarı mesajı yok).
  function refreshInstallUi() {
    const standalone = isStandalone();
    installButton.hidden = standalone || !deferredPrompt;
    installHelpButton.hidden = standalone || Boolean(deferredPrompt);
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

  // Kurulum yardımı açılınca bu cihaza uyan adım vurgulanır
  document.addEventListener("mavi:install-help", () => {
    const ios = isIos();
    stepIos.classList.toggle("is-current", ios);
    stepAndroid.classList.toggle("is-current", !ios);
  });

  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", refreshInstallUi);
  } catch (_) {
    // Eski tarayıcılar
  }

  refreshInstallUi();

  /* ---------- Güncelleme ----------
   * Yeni service worker kurulunca "bekleme" durumunda kalır; oyun ortasında kendiliğinden devreye girmez.
   * Kullanıcı "Şimdi Güncelle" derse SKIP_WAITING gönderilir ve controllerchange sonrası sayfa bir kez yenilenir.
   * İlk kurulumda (önceden kontrol eden SW yokken) yenileme yapılmaz. */
  let waitingWorker = null;
  let updateRequested = false;
  let reloading = false;

  function showUpdateUi(show) {
    for (const banner of updateBanners) banner.hidden = !show;
  }

  function trackWaiting(registration) {
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      showUpdateUi(true);
    }
  }

  function watchRegistration(registration) {
    trackWaiting(registration);
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") trackWaiting(registration);
      });
    });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-update-now]")) {
      if (!waitingWorker || updateRequested) return;
      updateRequested = true;
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else if (event.target.closest("[data-update-later]")) {
      showUpdateUi(false);
    }
  });

  // Service worker yalnızca güvenli bağlamda (HTTPS veya localhost) çalışır.
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    if (new URLSearchParams(window.location.search).get("nosw") === "1") return;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      // Yalnızca kullanıcı güncellemeyi istediyse ve yalnızca bir kez yenile (döngü olmaz)
      if (!updateRequested || reloading) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("service-worker.js")
      .then(watchRegistration)
      .catch((error) => {
        console.warn("Service worker kaydedilemedi; oyun çevrimiçi çalışmaya devam ediyor.", error);
      });
  }

  if (document.readyState === "complete") {
    registerServiceWorker();
  } else {
    window.addEventListener("load", registerServiceWorker);
  }
})();
