# Changelog

## 2026-09-26 — Sprint 3C.2: Başlangıçta Mavi joystick'in arkasında kalmasın (1.2.2)

- Ortak başlangıç noktası `LEVEL_DATA.start.x` 90 → 350 (tek doğruluk kaynağı `level-data.js`;
  `game.js` içindeki kopyalar kaldırıldı). Kamera başlangıçta yine x=0, dünya dışı gösterilmez.
- Ölçülen sprite–joystick boşluğu: 844x390 → 73 px, 915x412 → 78 px, çentikli 852x393 → 21 px,
  2556x1179 → 429 px (önce: −67, −71, −121, +3 px; negatif = örtüşme).
- İlk coin sıraları: Seviye 1 x=300 → 460, Seviye 2 x=250 → 460 (başlangıçtaki oyuncunun sağ kenarından
  60+ px ileride; hareket etmeden coin toplanamaz). Seviye 3–4 değişmedi.
- Seviye doğrulayıcıya kural: başlangıçta coin (60 px pay), kutu veya düşmanla çakışma yok.
- Yeni başlangıç, son güvenli nokta, çukur sonrası dönüş, Bölümü Yeniden Başlat ve Devam Et'te kullanılıyor.
- Test: Bölümü Yeniden Başlat testi puanı, Seviye 2'nin eski ilk coin sırasına istemeden bağlıydı; coin
  artık oyuncunun konumuna açıkça konuyor (beklenti aynı).

## 2026-09-26 — Sprint 3C.1: Geniş telefonlarda gerçek tam ekran (1.2.1)

- Sorun: oyun sabit 1280x720 (16:9) mantıksal görünümle çiziliyor ve CSS bu kutuyu ekrana sığdırıyordu.
  844x390 gibi ~2,16:1 ekranlarda iki yanda 75 px (2556x1179'da 230 px) boş şerit kalıyor, sahne ayrıca
  safe-area kadar içeriden başlıyordu.
- Çözüm: uyarlanabilir görünüm. Mantıksal yükseklik 720 sabit; mantıksal genişlik
  `720 × ekranGenişliği / ekranYüksekliği`, 1280–1680 aralığında. Canvas CSS oranı mantıksal oranla birebir
  (X ve Y ölçeği eşit, esneme yok). Dünya, fizik ve seviye verisi değişmedi; oyuncu aynı ölçekte biraz daha
  geniş alan görür (844x390'da 1558x720).
- Sahne ekranın dört kenarına uzanır; HUD, ses/duraklat ve klavye yardımı safe-area kadar içeride.
  Dar ekranlarda (tablet/masaüstü) üst/alt boşluk seviyenin gökyüzü/toprak rengiyle birleşir.
- Kamera sınırları, parallax döşemeleri, gökyüzü, çukur bandı, boss can çubuğu, kutlama paneli ve havai
  fişekler dinamik genişliğe göre çiziliyor.
- Geniş görünümde piksel bütçesi (≈1,1 MP): arka bellek önceki 16:9 telefon maliyetinde tutulur.
- Düzeltmeler: uzak silüet döşeme kenarında 2 px boşluk bırakıyordu; en sağ piksel sütunu yarı saydam kalabiliyordu.
- Test değişikliği: "oyun alanı taşmadan ekrana sığar ve 16:9 oranını korur" testi yeni ürün kararıyla
  çeliştiği için silinmedi; adı ve beklentisi "görüntü esnemeden ekranı dolduran uyarlanabilir görünüm"
  olarak güncellendi (mantıksal genişlik formülü, eşit X/Y ölçeği, kenar boşluğu ≤1 px, tuval arka belleği).

## 2026-09-26 — Sprint 3C: Devam Et, duraklatma, ayarlar ve PWA yayın cilası (1.2.0)

- Başlangıç ekranı: Yeni Macera, Devam Et (kayıt varsa), Nasıl Oynanır, Ayarlar, Uygulamayı Yükle / Kurulum Yardımı.
- Kampanya kaydı (`mavi-matematik-save`, version 1): yalnızca bölüm başında yazılır; can, kalkan, efekt ve açık soru kaydedilmez.
  Macera tamamlanınca kapanır. Yeni Macera onay ister, yalnızca kaydı temizler.
- Duraklatma: HUD düğmesi (48x48), Esc/P, arka plana geçişte otomatik. Menü: Devam Et, Bölümü Yeniden Başlat (onaylı),
  Nasıl Oynanır, Ayarlar, Ana Menü. Duraklatmada fizik, düşman, süre, animasyon, kamera ve girdiler donar.
- Ayarlar (`mavi-matematik-settings`): ses ve hareket efektleri; kullanıcı seçimi sistem ayarının önüne geçer.
- Tek menü penceresi, paneller arası geçiş; soru/tanıtım/özet/final açıkken ikinci pencere açılmaz.
- Pencere açıkken oyun alanı `inert`; pencerelerde odak tuzağı; soru kapanınca odak düzgün oyuna döner.
- Oyun sonu ve final ekranına "Ana Menü" düğmesi.
- PWA: kurulum yardımı paneli (Android/iOS), güncellemede "Yeni sürüm hazır" bildirimi ve tek seferlik yenileme;
  yeni service worker kullanıcı onayına kadar bekler.
- HUD simge düğmeleri tüm ekranlarda en az 48x48.

## 2026-09-26 — Sprint 3B: Benzersiz seviyeler ve matematik ilerlemesi

- Seviye verisi `level-data.js` dosyasına taşındı (statik, çevrimdışı güvenli, build ve service worker'da).
- Dört benzersiz seviye: Matematik Bahçesi, Sisli Vadi, Gün Batımı Kanyonu, Ayışığı Zirvesi.
- Seviyeye özgü uzak/orta/yakın silüetler, platform stilleri ve dekorlar; çukurlar için derinlik bandı.
- Matematik soru motoru seviyenin `mathProfile` verisini kullanıyor; negatif sonuç ve art arda tekrar yok,
  boss soruları da aynı profilden; testler için tohumlu (deterministik) üretim.
- Seviye tanıtımı (≤2 sn, dokunarak/Enter ile geçilir), seviye istatistikleri ve seviye sonu özeti.
- Son seviyede "Macera Tamamlandı": toplam skor ve genel doğruluk; top-10 skor kaydı korunuyor.
- Güvenli yeniden doğma: çukura düşünce son güvenli zemine dönülür (can kaybı kuralı aynı).
- Ayırt edilebilir kısa WebAudio sesleri (zıplama, iniş, coin, kutu, doğru, yanlış, kalkan, düşmana basma,
  hasar, roket, boss hasarı, seviye tamamlama); ses yalnızca kullanıcı etkileşiminden sonra başlar.
- Seviye doğrulayıcı (`npm run validate:levels`, build'e bağlı) ve gerçek fizikle rota/kutu testleri.
- `?level=N` debug parametresi; `tools/level-tour.mjs` seviye turu aracı.

## 2026-09-26 — Sprint 3A: Akıcı animasyon ve 2.5D görsel yenileme

- Mavi için animasyon durum makinesi: idle, walk, run, jump-start, jump-up, apex, fall, land, hurt, victory.
- Sprite sheet'teki pozlar tek tek ölçüldü (PLAYER_FRAMES); kare hızı gerçek hıza bağlı, ayak noktası sabit.
- tools/prepare-player-sheet.mjs: kutlama pozundaki gömülü dama deseni ve üç pozdaki gömülü gölge temizlendi.
- Düşmanlar: adım ritmi, gövde salınımı, oyuncu yaklaşınca tepki, basılınca sıkışıp kaybolma.
- 2.5D platformlar (önbellekte): açık üst yüzey, bevel, çim saçakları, dokulu ön yüz, yüzen platformlarda kayalık alt.
- Parallax: gökyüzü/ışık, uzak bulutlar (0,07), uzak dağlar (0,18), orta tepeler (0,42), yakın çalılar (0,7).
- Seviye atmosferleri: parlak gündüz, serin vadi (sis), gün batımı, mor akşam (ay ve yıldızlar).
- Efektler: koşu/zıplama/iniş tozu, coin parıltısı, kutu vuruşu, doğru/yanlış geri bildirimi, kalkan enerji halkası,
  boss vuruş parlaması + şok dalgası + en fazla 3 px sallama, iki katmanlı havai fişek.
- roket.png'den saydam roket gövdeleri çıkarıldı (tools/prepare-rocket-sprites.mjs); alev ve iz prosedürel.
- Kamera: FPS'ten bağımsız yumuşatma ve en fazla 70 px ileri bakış; sınırlar aynı.
- prefers-reduced-motion: sallama, şok dalgası, ileri bakış ve nefes alma kapalı; parçacıklar seyrek.
- Debug (F2 veya ?debug=1): animasyon, kare, FPS, parçacık sayısı, kamera.
- Performans: ekran dışı nesneler çizilmez, arka planın örtülen bölgeleri boyanmaz, sprite önbellekleri.
- 17 yeni görsel test (tests/visual.spec.mjs) ve görsel karşılaştırma aracı (tools/visual-snapshots.mjs).

## 2026-09-26 — Sprint 2.1: Analog joystick

- Ayrı sol/sağ ok düğmeleri kaldırıldı; sol alta yuvarlak analog joystick eklendi.
- Yatay eksen -1…+1, ölü bölge 0,18; hız sürükleme miktarıyla orantılı, yarıçapın %95'inde tam hız (MOVE_SPEED).
- Dikey sürükleme yalnızca topuzu oynatır, zıplatmaz. Klavye yönü basılıysa öncelikli.
- Joystick kendi pointerId'sini izler; zıplama ikinci parmakla bağımsız çalışır.
- pointerup/cancel/lostpointercapture, blur, visibilitychange, yön değişimi, soru ve oyun sonu joystick'i sıfırlar.
- Zıplama düğmesi joystick ile uyumlu cam görünümüne getirildi; yatay telefonda soru penceresi kontrollerin arasında kalacak kadar daraltıldı.
- Joystick için 11 yeni test; gerçek cihaz listesi joystick adımlarıyla güncellendi.

## 2026-09-26 — Sprint 2: Beta yayın hazırlığı

- Soru penceresine ekran içi sayı tuş takımı eklendi (0–9, Sil, Temizle, Cevabı Kontrol Et).
- Dokunmatik cihazlarda cevap alanı salt okunur; sistem klavyesi açılmıyor, iOS klavye sorunu ortadan kalktı.
- Tuş takımı ve Enter aynı form gönderimi ve doğrulamasından geçiyor.
- Boşluk tuşunun klavye odağındaki düğmeleri etkinleştirememesi düzeltildi.
- `npm run build`: bağımlılıksız yayın paketi (dist/), içerik hash'i ile otomatik cache sürümü, referans doğrulaması.
- `npm run preview` / `preview:subpath`: dist/ için yerel önizleme (alt dizin desteği).
- dist/ üzerinde alt dizin + PWA + çevrimdışı smoke testi eklendi.
- GitHub Pages için test → build → deploy workflow'u hazırlandı (henüz remote yok).
- REAL_DEVICE_TEST_CHECKLIST.md eklendi.

## 2026-09-26 — Sprint 1: Mobil uyumluluk ve PWA

- Git deposu başlatıldı; değişikliklerden önce baseline commit alındı.
- 960px minimum genişlik kaldırıldı; oyun alanı 16:9 oranıyla her ekrana sığıyor (100dvh + safe-area desteği).
- Canvas yüksek DPI ekranlarda keskin çiziliyor (DPR en fazla 2); fizik 1280x720 mantıksal koordinatta kaldı.
- Pointer Events ile dokunmatik sol/sağ/zıpla düğmeleri eklendi (çoklu dokunma, kaydırma, takılı kalma koruması).
- Oyuna "Oyuna Başla" ekranı, ses aç/kapat ve en iyi skor gösterimi eklendi; oyun başlamadan hareket etmiyor.
- Dikey kullanımda "Cihazını yan çevir" katmanı gösteriliyor, oyun bekliyor.
- Soru penceresi küçük ekranlarda üste hizalı tek satır düzende; sayısal klavye (inputmode/pattern/enterkeyhint).
- Esc / Android geri tuşu soru ve oyun sonu pencerelerini kapatıp oyunu kilitleyemiyor.
- Oyuncu adı alanında A, D, W ve boşluk yazılamama hatası düzeltildi.
- Oyun başında negatif dt yüzünden karakterin zeminden düşme riski giderildi.
- Kullanıcı metinlerinde Türkçe karakterler düzeltildi.
- HUD tablet ve telefonda kompakt/ikonlu hâle getirildi; boss can çubuğuyla çakışmıyor.
- Mobil için küçültülmüş görseller assets/img/ altına eklendi (23,5 MB → 3 MB). Orijinaller korunuyor.
- PWA: manifest.webmanifest, service-worker.js (çevrimdışı), pwa.js (kurulum düğmesi, iOS yönergesi), ikonlar.
- Playwright smoke/regresyon testleri eklendi (4 viewport).

## 2026-06-11

- Created the initial web game prototype.
- Added Canvas-based platform rendering, player movement, jumping, gravity, and platform collision.
- Added collectible coins worth 10 points with same-frame score/audio/removal behavior.
- Added one-time question boxes with addition, subtraction, and limited multiplication questions.
- Added correct-answer reward of 50 points and a 15-second shield.
- Added enemy patrols with shield/no-shield contact behavior.
- Added generated sound effects for coin, box, correct, wrong, shield, and enemy contact events.
- Added project tracking documents required by the quality-control rules.
- Increased player jump strength so upper platforms are reachable more comfortably.
- Raised player jump strength again after playtesting showed the upper layer still needed more clearance.
- Set player jump strength to 1200 after first-platform playtest feedback.
- Set player jump strength to 1500 for another reachability test.
- Reduced player jump strength to 900 after 1500 proved too high in playtesting.
- Replaced the numeric lives HUD with a three-heart display that shows lost hearts as empty.
- Fixed heart rendering to use clear red and gray heart icons.
- Added a game-over score dialog instead of automatically resetting after the third hit.
- Added enemy stomp behavior: jumping onto an enemy defeats it and bounces the player upward.
- Extended the world from 3300px to 5000px with more platforms, coins, question boxes, and enemies.
- Added a finish flag that advances from level 1 to level 2.
- Added level 2 with a new color palette and 10% faster enemies.
- Extended the world from 5000px to 6000px with an additional late-route section.
- Added levels 3 and 4 with new palettes and enemy speed multipliers of 1.15 and 1.20.
- Added a 30-second math question timer with a horizontal countdown bar.
- Added local top-10 final scores with player name entry on the result screen.
- Increased player jump speed from 900 to 1100 after playtesting.
- Added procedural run animation feel with body tilt, stronger bobbing, squash/stretch, and footstep dust.
- Added support for the cleaned player sprite sheet with frame-based idle, run, jump, and fall rendering.
- Restored the original single-image player sprite for idle so the character feet align correctly on platforms.
- Restored the player to three hearts when advancing to a new level.
- Added a double-clickable macOS launcher file that starts the local web server and opens the game.
- Extended the route from 6000px to 7500px.
- Added an end-of-level boss arena.
- Added a large boss monster with a health bar.
- Added ground fire attacks that the player can jump over.
- Added falling boss question boxes; correct answers launch rockets at the boss.
- Added a versioned `game.js` script URL so browsers load the latest boss-arena code instead of a cached build.
- Reworked boss rockets into a slower three-rocket diagonal salvo with colorful rocket art and impact particles.
- Integrated the supplied `enemy_boss.png` as the boss visual and generated a transparent-background `enemy_boss_clean.png` for in-game rendering.
- Tuned the boss fight so falling boxes stay away from the boss and the boss requires 6 correct answers.
- Updated shields to last 15 seconds for all correct answers and deactivate after absorbing 3 enemy or boss-fire hits.
- Restored boss-question shields to 10 seconds while keeping 3-hit shield durability.
- Added four level-specific boss images using cleaned transparent PNG variants.
- Changed boss rocket salvos into a 3-second cinematic strike that pauses boss fire and falling boxes while the rockets fly.
- Added a short fireworks celebration and next-level message after each boss defeat.
- Hardened the macOS launcher so it opens Google Chrome explicitly, falls back across ports 8081-8084, and closes its Terminal window after launch.
- Added a Windows double-click launcher that starts a local Python web server, opens Chrome or the default browser, and falls back across ports 8081-8084.
