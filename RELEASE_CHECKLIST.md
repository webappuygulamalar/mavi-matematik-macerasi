# Sürüm Kontrol Listesi

Her sürüm adayı (`x.y.z-rc.N`) ve son sürüm (`x.y.z`) için bu sırayla ilerle.
Bir adım kalırsa sonraki adıma geçme.

## 1. Kod ve sürüm

- [ ] Yalnızca planlanan değişiklikler var (sürüm adayında yeni özellik yok).
- [ ] `package.json` ve `package-lock.json` sürümü güncel (`npm version <sürüm> --no-git-tag-version`).
- [ ] Service worker önbellek adı build'de sürümden ve içerik özetinden otomatik üretilir.
  Elle değiştirme; `dist/build-info.json` içindeki `cacheVersion` değerini kontrol et.
- [ ] `CHANGELOG.md`, `KNOWN_ISSUES.md`, `README.md` ve gerekiyorsa `REAL_DEVICE_TEST_CHECKLIST.md` güncel.

## 2. Yerel doğrulama

```bash
npm run validate:levels
npm test
npm run build
npm run test:dist
npx playwright test tests/release.spec.mjs -g "Tam macera" --repeat-each=3   # kararlılık
```

- [ ] Hepsi geçti; atlanan testler yalnızca projeye özel `skip` olanlar.
- [ ] `dist/` toplamı ≤ 4 MB; tek dosya ≤ 2 MB (testler denetler).
- [ ] `git status` temiz; ekran görüntüleri, `dist/`, `test-results/` ve dahili belgeler git'te değil.

## 3. Güvenlik ve gizlilik

- [ ] Oyun yalnızca kendi dosyalarını yüklüyor.
  - Tam macera testi: dış istek yok, yalnızca GET.
- [ ] Oyuncu adı hiçbir yere gönderilmiyor; ekranda metin olarak gösteriliyor (HTML olarak değil).
- [ ] Analitik, reklam, izleyici, harici yazı tipi veya CDN yok.
- [ ] Depoda token, parola, kişisel bilgisayar yolu veya dahili belge yok:
  ```bash
  git grep -nIE "/Users/|ghp_|github_pat_|BEGIN (RSA|OPENSSH|PRIVATE)"
  ```
- [ ] Lisans dosyası yalnızca sahibinin kararıyla eklenir.

## 4. Yayın

- [ ] Anlamlı commit'ler.
- [ ] Mevcut `main` dalına normal push. Yeni dal açma, force-push yapma.
- [ ] GitHub Actions: test → build → yayın.
  - Test başarısızsa yayın adımı atlanmalı.
  - Yalnızca resmi `actions/*` kullanılır.
- [ ] Canlı adres açılıyor: https://webappuygulamalar.github.io/mavi-matematik-macerasi/
  - Masaüstü ve yatay telefon boyutunda kontrol et.
  - `build-info.json` yeni sürümü gösteriyor.
- [ ] Önceki sürüm kurulu bir tarayıcıda güncelleme:
  - "Yeni sürüm hazır" bildirimi görünüyor;
  - "Şimdi Güncelle" sayfayı tek kez yeniliyor;
  - eski önbellek siliniyor;
  - kayıt, ayarlar ve top-10 korunuyor.

## 5. Gerçek cihaz kabulü (son sürümden önce zorunlu)

- [ ] `REAL_DEVICE_TEST_CHECKLIST.md` dört cihaz grubunda dolduruldu:
  - iPhone, iPad, Android telefon, Android tablet.
- [ ] Engelleyici sorun yok. Kalan sorunlar `KNOWN_ISSUES.md` dosyasında.

## 6. Son sürüm

Yalnızca 5. adım tamamlandıktan sonra:

- [ ] Sürümü `x.y.z` yap (rc eki olmadan).
- [ ] 1–4. adımları tekrarla.
- [ ] `vX.Y.Z` etiketi ve GitHub Release oluştur.

Sürüm adayında etiket veya Release oluşturulmaz.

## Test ve debug adresleri

Aşağıdaki adresler yalnızca geliştirme ve test içindir. Oyuncu özelliği değildir; belgelerde öyle tanıtılmaz.

- `?autostart=1`
- `?level=N`
- `?boss=1`
- `&celebrate=1`
- `&rocket=1`
- `?nosw=1`
- `?debug=1`
