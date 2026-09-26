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
- (Sprint 2) GitHub Actions workflow hazır ama repo/remote olmadığı için hiç çalıştırılmadı.
