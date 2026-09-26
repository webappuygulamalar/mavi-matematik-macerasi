# Known Issues

- Current player and enemy PNGs are single images, not final sprite sheets. Animation is simulated with procedural motion until final frame sets are supplied.
- Browser verification has been performed on the available local browser path only; Edge and Firefox still need manual QA.
- The first level is hard-coded in `game.js`; later phases should move level data into editable JSON.
- Audio uses generated WebAudio tones as placeholders until final effects are provided.
- Heart HUD and game-over logic are currently fixed to a maximum of three lives.
- Levels 2, 3, and 4 currently reuse the extended level geometry with different palettes and faster enemies.
- High scores are stored in the current browser only through localStorage.
- Player animation now uses the cleaned sprite sheet for core movement, but some lower-row poses remain unused until the sheet is manually cleaned/cut more precisely.
- Boss arena uses supplied boss images per level, while fire, three-rocket salvo, fireworks, and health-bar visuals remain procedural until final effect assets are supplied.

## Sprint 1 (PWA) sonrası

- Service worker ve kurulum yalnızca HTTPS veya localhost üzerinde çalışır; telefonda yerel ağ IP'si (http://192.168.x.x) ile açıldığında oyun çalışır ama çevrimdışı/kurulum olmaz.
- Gerçek iPhone/iPad/Android cihazda manuel test yapılmadı; doğrulama Playwright Chromium mobil emülasyonuyla yapıldı.
- Kompakt HUD'daki kalkan simgesi (🛡) emoji olduğu için cihaza göre farklı görünebilir.
- (Sprint 2) Gerçek cihaz sonuçları REAL_DEVICE_TEST_CHECKLIST.md içinde henüz boş; bütün maddeler "Yapılmadı".
- Oyun https://webappuygulamalar.github.io/mavi-matematik-macerasi/ adresinde yayında; canlı adres yalnızca masaüstü tarayıcı emülasyonuyla doğrulandı.
- GitHub Actions, kullanılan action sürümleri için Node.js 20 kullanımdan kalkma uyarısı veriyor (şimdilik yalnızca uyarı).
- (Sprint 3A) Sprite sheet'te 4 poz kullanılmıyor: 3. satırdaki önden duruş ve iki başparmak pozu ile 4. satırdaki başparmak ve çömelme pozunda pantolon ve bacak arası gömülü dama deseniyle bozulmuş. Bu yüzden iniş ve zıplama başlangıcı ayrı poz yerine mevcut kareler + hafif sıkışma ile gösteriliyor. Temiz bir çömelme/iniş pozu gelirse PLAYER_ANIMATIONS'a eklenebilir.
- (Sprint 3A) Hasar için ayrı poz yok; havada zıplama pozu geriye eğilerek ve mevcut yanıp sönme ile kullanılıyor.
- (Sprint 3A) Performans ölçümü headless Chromium'da (yazılım tabanlı boyama, 4x yavaşlatılmış işlemci) yapıldı; gerçek düşük güçlü telefonda ölçülmedi.
- (Sprint 3B) Ana rota erişilebilirliği oyunun gerçek fiziğiyle adım adım test ediliyor; ancak tek bir çocuğun baştan sona kesintisiz oynadığı bir oturum otomatik olarak simüle edilmedi. Zorluk dengesi gerçek oyuncuyla denenmeli.
- (Sprint 3B) Kanyon (Seviye 3) uzak silüetinde mesaların dik kenarları arasında yer yer 1–2 px'lik ince aralık görünebilir.
- (Sprint 3C) Oyun bittiğinde (canlar tükenince) "Ana Menü" seçilirse bölüm başı kaydı korunur; "Devam Et" ile aynı bölüm yeniden oynanabilir. Bu durumda aynı maceradan skor tablosuna birden fazla kayıt girebilir.
- (Sprint 3C) Önceki sürümü kurmuş cihazlarda eski sayfa kodu güncelleme bildirimini göstermez; yeni kod ilk açılışta ağdan gelir ve bildirim bir sonraki açılışta görünür (veya uygulama tamamen kapanınca yeni sürüm kendiliğinden devreye girer).
- (Sprint 3C) Emoji simgeler (Nasıl Oynanır, kalkan) cihaza göre farklı görünebilir.
- (Sprint 3C.1) Geniş telefonlarda görünüm ekran kenarına kadar uzandığı için seviye başında (x=90) Mavi sol alttaki joystick'in arkasında kalır; ~120 px ilerleyince görünür. Joystick tabanı yarı saydamdır. Kalıcı çözüm için başlangıç noktasını veya kamera kuralını değiştirmek ürün kararı gerektirir.
- (Sprint 3C.1) 21:9'dan geniş ekranlarda (ör. ultra geniş monitör) görünüm 1680 mantıksal pikselde sınırlanır; kenarlar sahne rengiyle dolar.
- (Sprint 3C.1) Geniş telefonlarda çizim keskinliği performans için ~%10 düşürüldü (3x ekranlarda ~1,8x).
