# Gerçek Cihaz Test Listesi — Mavi’nin Matematik Macerası

Bu liste **yalnızca gerçek cihazla** doldurulur. Bilgisayardaki emülasyon (Playwright, tarayıcı geliştirici araçları) sonuçları buraya "Geçti" olarak yazılmaz.

## Nasıl doldurulur?

- Her madde için sonuç sütununa şunlardan birini yaz:
  - **Geçti** — sorunsuz çalıştı
  - **Kaldı** — çalışmadı veya bozuk görünüyor (Not sütununa ne olduğunu yaz)
  - **Yapılmadı** — denenmedi
- Sorun varsa ekran görüntüsü al ve dosya adını Not sütununa yaz.
- Başlangıçta her şey "Yapılmadı" durumundadır.

## Hazırlık

1. Oyun HTTPS adresinde yayında olmalı (örnek: `https://KULLANICI.github.io/REPO/`).
   Yerel ağ adresi (`http://192.168.x.x`) ile kurulum ve çevrimdışı açılış **çalışmaz**.
2. Cihazda daha önce oyun açıldıysa: tarayıcı ayarlarından site verilerini temizle, böylece ilk ziyaret gibi test edilir.
3. Sesin duyulması için cihazın sessiz modu kapalı, ses açık olsun.

## Test adımları (her cihazda aynı sıra)

Adım 28–43 Sprint 3C (kayıt, duraklatma, ayarlar, kurulum ve güncelleme) içindir.

| No | Adım | Beklenen |
|----|------|----------|
| 1 | HTTPS adresini tarayıcıda aç | Başlangıç ekranı gelir: "Mavi’nin Matematik Macerası", "Oyuna Başla", ses düğmesi |
| 2 | Cihazı **dikey** tut | "Cihazını yan çevir" uyarısı çıkar, oyun ilerlemez |
| 3 | Cihazı **yatay** çevir | Uyarı kaybolur, oyun alanı ekrana taşmadan sığar |
| 4 | Çentik / kamera deliği / ana ekran çizgisi kontrolü | Puan, kalp, kalkan, seviye, ses düğmesi ve dokunmatik tuşlar çentiğin veya kenarın altında kalmaz |
| 5 | "Oyuna Başla"ya dokun | Oyun başlar; başlamadan önce karakter hareket etmemişti |
| 6 | Sol alttaki yuvarlak joystick'i sağa ve sola sürükle | Az sürükleyince yavaş, kenara kadar sürükleyince hızlı yürür; ok düğmesi görünmez |
| 7 | "Zıpla"ya dokun | Karakter zıplar |
| 8 | Bir parmakla joystick'i sağa sürüklerken diğer parmakla zıpla | Karakter koşarak zıplar (çoklu dokunma) |
| 9 | Joystick'i bırak; ayrıca merkezde hafifçe oynat | Bırakınca topuz merkeze döner ve karakter hemen durur; merkezdeki küçük oynamada karakter kıpırdamaz |
| 10 | Joystick'e ve Zıpla'ya uzun bas / hızlı çift dokun; joystick'i ekran dışına doğru sürükle | Kopyala menüsü, büyüteç veya yakınlaştırma çıkmaz; sayfa kaymaz; joystick takılı kalmaz |
| 11 | İlk dokunuştan sonra altın topla | Ses duyulur (iOS'ta özellikle kontrol et) |
| 12 | Ses düğmesiyle sesi kapat / aç | Ses kapanır / açılır; tercih uygulama yeniden açılınca hatırlanır |
| 13 | Bir soru kutusuna çarp | Soru penceresi açılır, **telefonun kendi klavyesi açılmaz**, ekrandaki sayı tuşları görünür |
| 14 | Joystick'i sürüklerken bir soru kutusuna çarp | Soru açılınca karakter durur, joystick sıfırlanır |
| 15 | Sayı tuşlarıyla iki basamaklı cevap yaz, "Sil" ve "Temizle"yi dene | Rakamlar doğru yazılır, Sil son rakamı, Temizle tümünü siler |
| 16 | Doğru cevap ver, "Cevabı Kontrol Et" | "Doğru!" yazar, +50 puan, kalkan açılır, pencere kapanır |
| 17 | Başka bir kutuda yanlış cevap ver | "Yanlış cevap" yazar, puan eklenmez, pencere kapanır |
| 18 | Bir soruyu 30 saniye cevapsız bırak | "Süre bitti" yazar, pencere kapanır |
| 19 | Soru kapandıktan sonra joystick | Karakter yine hareket eder |
| 20 | Tüm canları kaybet, oyuncu adı yaz, "Yeniden Başlat" | Skor tablosuna eklenir, oyun baştan başlar |
| 21 | Boss testi: adresin sonuna `?boss=1&level=1` ekleyip aç | Boss arenası açılır; düşen kutudaki soruyu doğru cevaplayınca roketler boss'a gider, can çubuğu azalır |
| 22 | **Ana ekrana kur** (aşağıdaki cihaz notlarına bak) | Ana ekranda Mavi ikonu görünür |
| 23 | Ana ekran ikonundan aç | Adres çubuğu olmadan (standalone) açılır, ekran yatay |
| 24 | Uygulamayı tamamen kapat (uygulama değiştiriciden kaydır) ve tekrar aç | Başlangıç ekranında "En iyi skor" görünür, skor korunmuş |
| 25 | Uygulamayı bir kez açıp kapattıktan sonra **uçak modunu aç**, ana ekran ikonundan aç | Oyun internetsiz açılır, görseller görünür, oynanır |
| 26 | Uçak modunda bir soru çöz | Sayı tuş takımı ve cevap kontrolü çalışır |
| 27 | Genel görünüm | Taşan yazı, kesilen düğme veya okunamayacak kadar küçük metin yok |
| 28 | Başlangıç ekranı ilk açılışta | "Yeni Macera", "Nasıl Oynanır", "Ayarlar" ve kurulum düğmesi görünür; kayıt yoksa "Devam Et" görünmez |
| 29 | Seviye 2'ye geç, uygulamayı tamamen kapat ve tekrar aç | "Kayıtlı ilerleme: Seviye 2 — Sisli Vadi" ve "Devam Et" görünür |
| 30 | "Devam Et"e dokun | Seviye 2'nin başından başlar: 3 can, kalkan pasif, skor bölüm başındaki haliyle |
| 31 | Bir bölümün ortasında (coin toplayıp) uygulamayı kapat, tekrar açıp Devam Et | Yine bölümün başından başlar; toplanan coinler tekrar sayılmaz |
| 32 | Kayıt varken "Yeni Macera" | Onay penceresi çıkar; "Vazgeç" kaydı korur; "Evet" Seviye 1'den başlatır, skor tablosu ve ayarlar kalır |
| 33 | Oyunda sağ üstteki duraklat (⏸) düğmesine dokun | Oyun tamamen durur; menü: Devam Et, Bölümü Yeniden Başlat, Nasıl Oynanır, Ayarlar, Ana Menü |
| 34 | Joystick'i sürüklerken duraklat, sonra Devam Et | Karakter kendiliğinden yürümez veya zıplamaz; joystick merkezdedir |
| 35 | Oyun sırasında ana ekrana dön (uygulamayı arka plana al), sonra geri gel | Oyun duraklatılmış olarak bekler |
| 36 | Duraklatma → Bölümü Yeniden Başlat | Kısa onay sorulur; "Evet" bölümü baştan başlatır |
| 37 | Duraklatma → Ana Menü, sonra Devam Et | Aynı bölümün başından sürer |
| 38 | Ayarlar → Hareket efektleri: Azaltılmış | Boss vuruşunda ekran sallanmaz, efektler sadeleşir; ayar uygulama yeniden açılınca hatırlanır |
| 39 | Nasıl Oynanır | Tek ekranda okunaklı; taşan veya kesilen yazı yok |
| 40 | Kurulu değilken başlangıç ekranı | Android Chrome'da "Uygulamayı Yükle" (veya "Kurulum Yardımı"); iPhone/iPad'de "Kurulum Yardımı" Safari adımını vurgular |
| 41 | Ana ekrandan (kurulu) açıldığında | Yükleme ve kurulum yardımı düğmeleri görünmez |
| 42 | Yeni bir sürüm yayınlandıktan sonra uygulamayı aç | "Yeni sürüm hazır" bildirimi; "Şimdi Güncelle" bir kez yeniler, "Sonra" kapatır; oyun ortasında kendiliğinden yenilenmez |
| 43 | Menüler ve düğmeler | Hiçbir menü veya düğme ekrandan taşmaz; çentik/ana ekran çizgisi düğmeleri örtmez |

### Cihaza kurulum notları

- **iPhone / iPad (Safari):** Paylaş düğmesi (yukarı ok olan kare) → "Ana Ekrana Ekle" → "Ekle". Başlangıç ekranında da bu yönerge görünür olmalı.
- **Android (Chrome):** Başlangıç ekranındaki "Uygulamayı Yükle" düğmesi veya menü (⋮) → "Uygulamayı yükle" / "Ana ekrana ekle".

---

## Sonuç formları

Her cihaz grubu için ayrı doldur. Aynı gruptan birden fazla cihaz denenirse formu kopyala.

### 1) iPhone / Safari

- Test eden:
- Tarih:
- Cihaz modeli:
- iOS sürümü:
- Tarayıcı ve sürümü: Safari
- Test adresi:

| No | Sonuç | Not |
|----|-------|-----|
| 1 | Yapılmadı | |
| 2 | Yapılmadı | |
| 3 | Yapılmadı | |
| 4 | Yapılmadı | |
| 5 | Yapılmadı | |
| 6 | Yapılmadı | |
| 7 | Yapılmadı | |
| 8 | Yapılmadı | |
| 9 | Yapılmadı | |
| 10 | Yapılmadı | |
| 11 | Yapılmadı | |
| 12 | Yapılmadı | |
| 13 | Yapılmadı | |
| 14 | Yapılmadı | |
| 15 | Yapılmadı | |
| 16 | Yapılmadı | |
| 17 | Yapılmadı | |
| 18 | Yapılmadı | |
| 19 | Yapılmadı | |
| 20 | Yapılmadı | |
| 21 | Yapılmadı | |
| 22 | Yapılmadı | |
| 23 | Yapılmadı | |
| 24 | Yapılmadı | |
| 25 | Yapılmadı | |
| 26 | Yapılmadı | |
| 27 | Yapılmadı | |
| 28 | Yapılmadı | |
| 29 | Yapılmadı | |
| 30 | Yapılmadı | |
| 31 | Yapılmadı | |
| 32 | Yapılmadı | |
| 33 | Yapılmadı | |
| 34 | Yapılmadı | |
| 35 | Yapılmadı | |
| 36 | Yapılmadı | |
| 37 | Yapılmadı | |
| 38 | Yapılmadı | |
| 39 | Yapılmadı | |
| 40 | Yapılmadı | |
| 41 | Yapılmadı | |
| 42 | Yapılmadı | |
| 43 | Yapılmadı | |

### 2) iPad / Safari

- Test eden:
- Tarih:
- Cihaz modeli:
- iPadOS sürümü:
- Tarayıcı ve sürümü: Safari
- Test adresi:
- Klavye bağlı mı? (Evet/Hayır):

| No | Sonuç | Not |
|----|-------|-----|
| 1 | Yapılmadı | |
| 2 | Yapılmadı | |
| 3 | Yapılmadı | |
| 4 | Yapılmadı | |
| 5 | Yapılmadı | |
| 6 | Yapılmadı | |
| 7 | Yapılmadı | |
| 8 | Yapılmadı | |
| 9 | Yapılmadı | |
| 10 | Yapılmadı | |
| 11 | Yapılmadı | |
| 12 | Yapılmadı | |
| 13 | Yapılmadı | |
| 14 | Yapılmadı | |
| 15 | Yapılmadı | |
| 16 | Yapılmadı | |
| 17 | Yapılmadı | |
| 18 | Yapılmadı | |
| 19 | Yapılmadı | |
| 20 | Yapılmadı | |
| 21 | Yapılmadı | |
| 22 | Yapılmadı | |
| 23 | Yapılmadı | |
| 24 | Yapılmadı | |
| 25 | Yapılmadı | |
| 26 | Yapılmadı | |
| 27 | Yapılmadı | |
| 28 | Yapılmadı | |
| 29 | Yapılmadı | |
| 30 | Yapılmadı | |
| 31 | Yapılmadı | |
| 32 | Yapılmadı | |
| 33 | Yapılmadı | |
| 34 | Yapılmadı | |
| 35 | Yapılmadı | |
| 36 | Yapılmadı | |
| 37 | Yapılmadı | |
| 38 | Yapılmadı | |
| 39 | Yapılmadı | |
| 40 | Yapılmadı | |
| 41 | Yapılmadı | |
| 42 | Yapılmadı | |
| 43 | Yapılmadı | |

### 3) Android telefon / Chrome

- Test eden:
- Tarih:
- Cihaz modeli:
- Android sürümü:
- Tarayıcı ve sürümü: Chrome
- Test adresi:

| No | Sonuç | Not |
|----|-------|-----|
| 1 | Yapılmadı | |
| 2 | Yapılmadı | |
| 3 | Yapılmadı | |
| 4 | Yapılmadı | |
| 5 | Yapılmadı | |
| 6 | Yapılmadı | |
| 7 | Yapılmadı | |
| 8 | Yapılmadı | |
| 9 | Yapılmadı | |
| 10 | Yapılmadı | |
| 11 | Yapılmadı | |
| 12 | Yapılmadı | |
| 13 | Yapılmadı | |
| 14 | Yapılmadı | |
| 15 | Yapılmadı | |
| 16 | Yapılmadı | |
| 17 | Yapılmadı | |
| 18 | Yapılmadı | |
| 19 | Yapılmadı | |
| 20 | Yapılmadı | |
| 21 | Yapılmadı | |
| 22 | Yapılmadı | |
| 23 | Yapılmadı | |
| 24 | Yapılmadı | |
| 25 | Yapılmadı | |
| 26 | Yapılmadı | |
| 27 | Yapılmadı | |
| 28 | Yapılmadı | |
| 29 | Yapılmadı | |
| 30 | Yapılmadı | |
| 31 | Yapılmadı | |
| 32 | Yapılmadı | |
| 33 | Yapılmadı | |
| 34 | Yapılmadı | |
| 35 | Yapılmadı | |
| 36 | Yapılmadı | |
| 37 | Yapılmadı | |
| 38 | Yapılmadı | |
| 39 | Yapılmadı | |
| 40 | Yapılmadı | |
| 41 | Yapılmadı | |
| 42 | Yapılmadı | |
| 43 | Yapılmadı | |

### 4) Android tablet / Chrome

- Test eden:
- Tarih:
- Cihaz modeli:
- Android sürümü:
- Tarayıcı ve sürümü: Chrome
- Test adresi:

| No | Sonuç | Not |
|----|-------|-----|
| 1 | Yapılmadı | |
| 2 | Yapılmadı | |
| 3 | Yapılmadı | |
| 4 | Yapılmadı | |
| 5 | Yapılmadı | |
| 6 | Yapılmadı | |
| 7 | Yapılmadı | |
| 8 | Yapılmadı | |
| 9 | Yapılmadı | |
| 10 | Yapılmadı | |
| 11 | Yapılmadı | |
| 12 | Yapılmadı | |
| 13 | Yapılmadı | |
| 14 | Yapılmadı | |
| 15 | Yapılmadı | |
| 16 | Yapılmadı | |
| 17 | Yapılmadı | |
| 18 | Yapılmadı | |
| 19 | Yapılmadı | |
| 20 | Yapılmadı | |
| 21 | Yapılmadı | |
| 22 | Yapılmadı | |
| 23 | Yapılmadı | |
| 24 | Yapılmadı | |
| 25 | Yapılmadı | |
| 26 | Yapılmadı | |
| 27 | Yapılmadı | |
| 28 | Yapılmadı | |
| 29 | Yapılmadı | |
| 30 | Yapılmadı | |
| 31 | Yapılmadı | |
| 32 | Yapılmadı | |
| 33 | Yapılmadı | |
| 34 | Yapılmadı | |
| 35 | Yapılmadı | |
| 36 | Yapılmadı | |
| 37 | Yapılmadı | |
| 38 | Yapılmadı | |
| 39 | Yapılmadı | |
| 40 | Yapılmadı | |
| 41 | Yapılmadı | |
| 42 | Yapılmadı | |
| 43 | Yapılmadı | |

---

## Genel sonuç

| Cihaz grubu | Durum | Engelleyici sorun var mı? |
|-------------|-------|---------------------------|
| iPhone / Safari | Yapılmadı | |
| iPad / Safari | Yapılmadı | |
| Android telefon / Chrome | Yapılmadı | |
| Android tablet / Chrome | Yapılmadı | |
