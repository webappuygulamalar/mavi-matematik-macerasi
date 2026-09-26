# Changelog

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
