# Mavi’nin Matematik Macerası

Çocuklar için Türkçe, 2D yan kaydırmalı eğitici platform oyunu. Mavi ile zıpla, altın topla, soru kutularındaki toplama, çıkarma ve çarpma sorularını çöz, kalkan kazan ve her seviyenin sonundaki büyük canavarı yen.

**Oyna:** https://webappuygulamalar.github.io/mavi-matematik-macerasi/

## Özellikler

- 4 farklı seviye, her birinin sonunda boss savaşı:
  1. **Matematik Bahçesi** — toplama ve çıkarma, sonuçlar 20'ye kadar
  2. **Sisli Vadi** — 100'e kadar toplama/çıkarma, 2 ve 5 ile çarpma
  3. **Gün Batımı Kanyonu** — 100'e kadar işlemler, çarpım tablosu (2–9)
  4. **Ayışığı Zirvesi** — karışık işlemler, çarpma ağırlıklı
- Seviye tanıtımı ve seviye sonu özeti (puan, coin, doğru/soru, doğruluk)
- **Devam Et:** ilerleme her bölüm başında cihaza kaydedilir; uygulama kapanırsa aynı bölümün başından sürer
- **Duraklatma:** sağ üstteki ⏸ düğmesi, masaüstünde <kbd>Esc</kbd> veya <kbd>P</kbd>; uygulama arka plana gidince otomatik
- **Ayarlar:** ses ve hareket efektleri (Normal/Azaltılmış); ilk varsayılan cihazın "hareketi azalt" ayarından gelir
- **Nasıl Oynanır** ekranı ve kurulum yardımı
- Matematik soru kutuları: doğru cevap +50 puan ve geçici kalkan
- Ekran içi çocuk dostu sayı tuş takımı (telefon klavyesine gerek yok)
- Telefon, tablet ve masaüstünde çalışır; yatay kullanım için tasarlandı. Geniş telefonlarda oyun ekranın tamamını doldurur (görüntü esnemez; oyuncu biraz daha geniş alan görür)
- Cihaza kurulabilir (PWA) ve ilk açılıştan sonra internetsiz oynanır
- Yerel skor tablosu (skorlar yalnızca bu cihazdaki tarayıcıda saklanır)
- Sunucu, üyelik, reklam veya analitik yok
- Saf HTML, CSS ve JavaScript; framework yok

## Kontroller

| | Masaüstü | Telefon / tablet |
|---|---|---|
| Sola / sağa | `A` / `D` veya ← / → | Sol alttaki ok düğmeleri |
| Zıpla | `W`, ↑ veya Boşluk | Sağ alttaki "Zıpla" düğmesi |
| Soru cevabı | Klavye ile rakam + Enter veya ekrandaki tuşlar | Ekrandaki sayı tuşları + "Cevabı Kontrol Et" |

Yön ve zıplama aynı anda kullanılabilir. Telefon dikey tutulursa oyun, cihazı yan çevirmeni ister.

## Cihaza kurma

- **Android (Chrome):** Oyunun başlangıç ekranındaki "Uygulamayı Yükle" düğmesine dokun veya menüden (⋮) "Uygulamayı yükle"yi seç.
- **iPhone / iPad (Safari):** Paylaş düğmesi → "Ana Ekrana Ekle".
- **Masaüstü (Chrome / Edge):** Adres çubuğundaki yükleme simgesi veya başlangıç ekranındaki "Uygulamayı Yükle" düğmesi.

Kurduktan sonra oyunu bir kez açman yeterli; sonrasında internet olmadan da açılır.

Tarayıcı doğrudan kurulum sunmuyorsa başlangıç ekranında **Kurulum Yardımı** adımları gösterilir. Yeni bir sürüm yayınlandığında oyunda **"Yeni sürüm hazır"** bildirimi çıkar; **Şimdi Güncelle** sayfayı bir kez yeniler, **Sonra** bildirimi kapatır. Güncelleme oyunun ortasında kendiliğinden uygulanmaz.

### Cihazda saklanan veriler (localStorage)

| Anahtar | İçerik |
|---|---|
| `mavi-matematik-save` | Bölüm başı kaydı: `version`, seviye, bölüm başındaki toplam skor ve genel istatistikler |
| `mavi-matematik-settings` | `version`, ses, hareket efektleri |
| `mavi-matematik-high-scores` | En yüksek 10 skor |

Bozuk veya eski sürüm veri yok sayılır; oyun varsayılanlarla açılır.

## Geliştirme

Gereken: Node.js 20+ ve Python 3 (yerel geliştirme sunucusu için).

```bash
npm install                 # test araçlarını kurar
npm run serve               # http://127.0.0.1:8081 adresinde geliştirme sürümü
```

Debug adresleri: `?level=3` doğrudan 3. seviyeyi açar; `?boss=1&level=1` boss arenasını açar (`level` 1–4); `?debug=1` debug panelini gösterir.

### Seviye verisi

Seviyeler `level-data.js` dosyasındadır (platformlar, coinler, soru kutuları, düşmanlar, tema, atmosfer, matematik profili ve ana rota). Oyun kodundan bağımsızdır.

```bash
npm run validate:levels     # şema, sınırlar, yerleşimler ve ana rota erişilebilirliği
```

Build de bu doğrulamayı çalıştırır; geçersiz seviye verisiyle yayın paketi üretilmez. Testler ayrıca her seviyenin ana rotasını oyunun gerçek fiziğiyle baştan boss arenasına kadar dener.

### Testler

```bash
npx playwright install chromium   # ilk seferde
npm test                          # tüm testler (4 ekran boyutu + dist/ paketi)
npm run test:dist                 # yalnızca yayın paketi, PWA ve çevrimdışı testi
```

### Yayın paketi

```bash
npm run build               # dist/ klasörünü temiz biçimde üretir
npm run preview             # dist/ klasörünü http://127.0.0.1:4173 adresinde önizler
npm run preview:subpath     # alt dizinde yayını taklit eder (/mavi-matematik-macerasi/)
```

`dist/` herhangi bir HTTPS statik barındırma servisine yüklenebilir. Service worker önbellek sürümü dosya içeriklerinden otomatik üretilir; her yeni build'de eski önbellek temizlenir.

`main` dalına yapılan her push, GitHub Actions ile önce testleri çalıştırır; testler geçerse `dist/` paketini GitHub Pages'e yayınlar.

## Proje yapısı

```
index.html, styles.css, game.js   Oyun
pwa.js, service-worker.js         Kurulum ve çevrimdışı çalışma
manifest.webmanifest              PWA bilgileri
assets/img, assets/icons          Mobil için küçültülmüş görseller ve ikonlar
tools/                            Build, önizleme ve ikon üretme betikleri
tests/                            Playwright testleri
```

Kök dizindeki büyük PNG dosyaları görsellerin orijinal kaynaklarıdır; yayın paketine girmez.
