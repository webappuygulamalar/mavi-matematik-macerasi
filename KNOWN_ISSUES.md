# Bilinen Sorunlar

Sürüm: **1.3.0**. Aşağıdakiler bilinen küçük sorunlardır; hiçbiri oyunu oynamayı engellemez.
Sürüm, yayından önce gerçek telefon ve tablette kabul testinden geçti.

## Oyun

- Oyun bittiğinde (canlar tükenince) "Ana Menü" seçilirse bölüm başı kaydı korunur; "Devam Et" ile aynı
  bölüm yeniden oynanabilir. Bu durumda aynı maceradan skor tablosuna birden fazla kayıt girebilir.

## Görsel

- Kanyon (Seviye 3) uzak silüetinde mesaların dik kenarları arasında yer yer 1–2 px'lik ince aralık görünebilir.
- Emoji simgeler (kalkan, Nasıl Oynanır) cihaza göre farklı görünebilir.
- Geniş telefonlarda çizim keskinliği performans için ~%10 düşürüldü (3x ekranlarda ~1,8x).
- 21:9'dan geniş ekranlarda (ör. ultra geniş monitör) görünüm 1680 mantıksal pikselde sınırlanır; kenarlar sahne rengiyle dolar.
- Sprite sheet'te 4 poz kullanılmıyor (bozuk dama deseni). İniş ve zıplama başlangıcı mevcut kareler ve
  hafif sıkışma ile gösteriliyor; hasar için ayrı poz yok.

## PWA

- Service worker ve kurulum yalnızca HTTPS veya localhost üzerinde çalışır. Yerel ağ adresi
  (`http://192.168.x.x`) ile açılınca oyun çalışır, ama çevrimdışı açılış ve kurulum olmaz.
- Önceki sürümü kurmuş cihazlarda eski sayfa kodu güncelleme bildirimini hemen göstermeyebilir. Yeni kod ilk
  açılışta ağdan gelir; bildirim bir sonraki açılışta görünür. Uygulama tamamen kapanınca yeni sürüm
  kendiliğinden devreye girer.
- Skorlar ve kayıt yalnızca bu cihazdaki tarayıcıda tutulur. Gizli sekmede veya depolama kapalıyken oyun
  oynanır, ama kayıt ve skor tutulamaz ("Skor kaydedilemedi.").

## Doğrulama kapsamı

- Firefox ve masaüstü Safari elle denenmedi. Otomatik testler Chromium ile çalışır.

## 1.3.0'da çözülenler

- Seviye özeti açıkken sayfa kapanınca tamamlanan bölüm kayıtta görünmüyordu; Devam Et artık sonraki bölümden sürüyor.
- Kısa ekranlarda final penceresindeki ad kutusu 44 px'ti; artık 48 px.
- GitHub Actions'taki Node.js 20 kullanımdan kalkma uyarısı: resmi action'lar Node 24 sürümlerine yükseltildi.
- Başlangıçta Mavi'nin joystick'in arkasında kalması: başlangıç x=350 (1.2.2).
- Geniş telefonlarda iki yanda boş şerit (1.2.1).
