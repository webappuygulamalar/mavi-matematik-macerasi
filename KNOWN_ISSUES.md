# Bilinen Sorunlar

Sürüm: **1.3.0-rc.1** (sürüm adayı). Aşağıdakilerin hiçbiri yayını engellemez; gerçek cihaz kabul testinde
([REAL_DEVICE_TEST_CHECKLIST.md](REAL_DEVICE_TEST_CHECKLIST.md)) özellikle bakılacak noktalardır.

## Doğrulama kapsamı

- Otomatik testler ve performans ölçümleri Playwright Chromium (masaüstü ve mobil emülasyon) ile yapıldı.
  Gerçek iPhone, iPad ve Android cihazda test yapılmadı; kontrol listesindeki bütün maddeler "Yapılmadı".
- Firefox ve masaüstü Safari elle denenmedi.
- Sekmenin arka plana alınması testlerde `visibilitychange` olayı taklit edilerek sınanır; gerçek cihazda
  işletim sisteminin sayfayı dondurması veya kapatması ayrıca denenmeli.
- Performans headless Chromium'da (yazılım tabanlı boyama, 4x yavaşlatılmış işlemci) ölçüldü. Tablet
  boyutunda (1024x768, DPR 2) 4x yavaşlatmada ~29 FPS ölçülüyor. Bu değer 1.2.2 ile aynı; 2x yavaşlatmada 59 FPS.
  Gerçek tablette akıcılık kontrol edilmeli.

## Oyun

- Oyun bittiğinde (canlar tükenince) "Ana Menü" seçilirse bölüm başı kaydı korunur; "Devam Et" ile aynı
  bölüm yeniden oynanabilir. Bu durumda aynı maceradan skor tablosuna birden fazla kayıt girebilir.
- Can sayısı en fazla 3 ile sabittir.
- Sesler WebAudio ile üretilen kısa tonlardır. Gerçek ses dosyaları yoktur.
- Skor tablosu yalnızca bu cihazdaki tarayıcıda tutulur; tarayıcı verisi silinirse kaybolur.
  Gizli sekmede veya depolama kapalıyken oyun oynanır, ama kayıt ve skor tutulamaz ("Skor kaydedilemedi.").

## Görsel

- Sprite sheet'te 4 poz kullanılmıyor (bozuk dama deseni). İniş ve zıplama başlangıcı mevcut kareler ve
  hafif sıkışma ile gösteriliyor; hasar için ayrı poz yok.
- Kanyon (Seviye 3) uzak silüetinde mesaların dik kenarları arasında yer yer 1–2 px'lik ince aralık görünebilir.
- Emoji simgeler (kalkan, Nasıl Oynanır) cihaza göre farklı görünebilir.
- Geniş telefonlarda çizim keskinliği performans için ~%10 düşürüldü (3x ekranlarda ~1,8x).
- 21:9'dan geniş ekranlarda görünüm 1680 mantıksal pikselde sınırlanır; kenarlar sahne rengiyle dolar.
- Boss ateşi, roket salvosu, havai fişek ve can çubuğu çizimle üretilir (ayrı efekt görseli yok).

## PWA ve yayın

- Service worker ve kurulum yalnızca HTTPS veya localhost üzerinde çalışır. Yerel ağ adresi
  (`http://192.168.x.x`) ile açılınca oyun çalışır, ama çevrimdışı açılış ve kurulum olmaz.
- Önceki sürümü kurmuş cihazlarda eski sayfa kodu güncelleme bildirimini hemen göstermeyebilir. Yeni kod ilk
  açılışta ağdan gelir; bildirim bir sonraki açılışta görünür. Uygulama tamamen kapanınca yeni sürüm
  kendiliğinden devreye girer.
- Lisans henüz belirlenmedi; depoda lisans dosyası yok.

## Çözülenler

- (1.3.0-rc.1) Seviye özeti açıkken sayfa kapanınca tamamlanan bölüm kayıtta görünmüyordu; Devam Et artık sonraki bölümden sürüyor.
- (1.3.0-rc.1) Kısa ekranlarda final penceresindeki ad kutusu 44 px'ti; artık 48 px.
- (1.3.0-rc.1) GitHub Actions'taki Node.js 20 kullanımdan kalkma uyarısı: resmi action'lar Node 24 sürümlerine yükseltildi.
- (1.2.2) Başlangıçta Mavi'nin joystick'in arkasında kalması: başlangıç x=350.
- (1.2.1) Geniş telefonlarda iki yanda boş şerit.
- (Sprint 3B) Seviye verisi `game.js` içindeydi ve 2–4. seviyeler aynı geometriyi kullanıyordu: dört benzersiz seviye `level-data.js` dosyasında.
