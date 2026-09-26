# Mavi’nin Matematik Macerası

Çocuklar için Türkçe, 2D yan kaydırmalı eğitici platform oyunu. Mavi ile zıpla, altın topla, soru kutularındaki toplama, çıkarma ve çarpma sorularını çöz, kalkan kazan ve her seviyenin sonundaki büyük canavarı yen.

**Oyna:** https://webappuygulamalar.github.io/mavi-matematik-macerasi/

## Özellikler

- 4 seviye, her seviyenin sonunda boss savaşı
- Matematik soru kutuları: doğru cevap +50 puan ve geçici kalkan
- Ekran içi çocuk dostu sayı tuş takımı (telefon klavyesine gerek yok)
- Telefon, tablet ve masaüstünde çalışır; yatay kullanım için tasarlandı
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

## Geliştirme

Gereken: Node.js 20+ ve Python 3 (yerel geliştirme sunucusu için).

```bash
npm install                 # test araçlarını kurar
npm run serve               # http://127.0.0.1:8081 adresinde geliştirme sürümü
```

Debug adresleri: `?boss=1&level=1` doğrudan boss arenasını açar (`level` 1–4).

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
