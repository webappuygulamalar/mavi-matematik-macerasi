// dist/ yayın paketi üzerinde PWA ve çevrimdışı smoke testi.
// Paket GitHub Pages benzeri bir alt dizinde (/mavi-matematik-macerasi/) sunulur.
import { test as base, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "dist");
const BASE_PATH = "/mavi-matematik-macerasi/";

const test = base.extend({
  consoleErrors: async ({ page }, use) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) errors.push(`${res.status()} ${res.url()}`);
    });
    await use(errors);
    expect(errors, "konsolda hata ve başarısız istek olmamalı").toEqual([]);
  }
});

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]
  );
}

function fingerprint(dir) {
  return Object.fromEntries(
    listFiles(dir)
      .map((f) => [relative(dir, f), createHash("sha256").update(readFileSync(f)).digest("hex")])
      .sort()
  );
}

test.describe("Yayın paketi (dist/)", () => {
  test("yalnızca çalışma dosyalarını içerir, büyük kaynak görsel yok", () => {
    const files = listFiles(DIST).map((f) => relative(DIST, f)).sort();
    const allowed = /^(index\.html|styles\.css|level-data\.js|game\.js|pwa\.js|manifest\.webmanifest|service-worker\.js|build-info\.json|assets\/(img|icons)\/[\w.-]+\.png)$/;
    for (const f of files) expect(f, "izin verilmeyen dosya").toMatch(allowed);
    for (const f of listFiles(DIST)) expect(statSync(f).size, f).toBeLessThan(2 * 1024 * 1024);
    // Toplam paket bütçesi: 4 MB
    const total = listFiles(DIST).reduce((sum, f) => sum + statSync(f).size, 0);
    expect(total, `dist toplamı ${(total / 1048576).toFixed(2)} MB`).toBeLessThanOrEqual(4 * 1024 * 1024);
    // Kök dizindeki orijinal 2048px görseller pakete girmez
    for (const original of ["enemy_boss.png", "enemy_boss_clean.png", "player_spritesheet.png", "roket.png"]) {
      expect(files).not.toContain(original);
    }
  });

  test("build tekrar edilebilir: aynı kaynaktan aynı çıktı", () => {
    const out = mkdtempSync(join(tmpdir(), "mavi-build-"));
    try {
      execFileSync(process.execPath, [join(ROOT, "tools/build.mjs"), "--out", out], { stdio: "pipe" });
      expect(fingerprint(out)).toEqual(fingerprint(DIST));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test("alt dizinde açılır; manifest, ikonlar ve bütün istekler geçerli", async ({ page, request, consoleErrors }) => {
    const requested = [];
    page.on("request", (req) => requested.push(new URL(req.url()).pathname));
    await page.goto("./?nosw=1");
    await expect(page.locator("#startDialog")).toBeVisible();
    for (const p of requested) expect(p.startsWith(BASE_PATH), `alt dizin dışı istek: ${p}`).toBe(true);

    const manifestUrl = new URL(await page.locator('link[rel="manifest"]').getAttribute("href"), page.url()).href;
    const res = await request.get(manifestUrl);
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("application/manifest+json");
    const manifest = await res.json();
    expect(manifest).toMatchObject({ start_url: "./", scope: "./", display: "standalone", orientation: "landscape" });
    for (const icon of manifest.icons) {
      const iconUrl = new URL(icon.src, manifestUrl);
      expect(iconUrl.pathname.startsWith(BASE_PATH)).toBe(true);
      const r = await request.get(iconUrl.href);
      expect(r.ok(), icon.src).toBe(true);
      expect(r.headers()["content-type"]).toBe("image/png");
    }
    const startUrl = new URL(manifest.start_url, manifestUrl);
    expect(startUrl.pathname).toBe(BASE_PATH);
  });

  test("service worker alt dizin kapsamıyla kaydolur, oyun çevrimdışı açılır ve oynanır", async ({ page, context, consoleErrors }) => {
    test.slow();
    const info = JSON.parse(readFileSync(join(DIST, "build-info.json"), "utf8"));
    await page.goto("./");
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
    expect(new URL(scope).pathname).toBe(BASE_PATH);
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    const cache = await page.evaluate(async () => {
      const names = await caches.keys();
      const name = names.find((n) => n.startsWith("mavi-matematik-"));
      const c = await caches.open(name);
      return { names, name, urls: (await c.keys()).map((r) => new URL(r.url).pathname) };
    });
    expect(cache.name).toBe(`mavi-matematik-${info.cacheVersion}`);
    const expected = listFiles(DIST)
      .map((f) => relative(DIST, f))
      // service-worker.js tarayıcının kendi SW deposunda tutulur, uygulama önbelleğinde olması gerekmez.
      .filter((f) => f !== "build-info.json" && f !== "service-worker.js")
      .map((f) => BASE_PATH + f);
    expect(cache.urls).toEqual(expect.arrayContaining(expected));

    // Çevrimdışı Devam Et: kayıtlı Seviye 2 önbellekten açılır
    await page.evaluate(() => localStorage.setItem("mavi-matematik-save", JSON.stringify({ version: 1, level: 2, score: 270, totalStats: { coins: 2, questions: 2, correct: 1 }, savedAt: "2026-09-26T10:00:00Z" })));
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("#continueButton")).toBeVisible();
    await page.locator("#continueButton").tap();
    await page.locator("#levelIntro").tap();
    await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__.player.grounded)).toBe(true);
    expect(await page.evaluate(() => ({ level: window.__MAVI_GAME__.state.level, score: window.__MAVI_GAME__.state.score }))).toEqual({ level: 2, score: 270 });

    // Çevrimdışı dört seviye: her biri açılır, bütün görseller önbellekten yüklenir
    const swSource = readFileSync(join(DIST, "service-worker.js"), "utf8");
    const imageList = [...swSource.matchAll(/"\.\/(assets\/[^"]+\.png)"/g)].map((m) => m[1]);
    expect(imageList.length).toBeGreaterThanOrEqual(13);
    for (const level of [1, 2, 3, 4]) {
      await page.goto(`./?level=${level}&autostart=1`);
      await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.state.level)).toBe(level);
      const imgs = await page.evaluate(async (list) => {
        const res = await Promise.all(list.map((p) => fetch(p).then((r) => r.ok && r.headers.get("content-type").includes("png"), () => false)));
        const broken = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src);
        return { allOk: res.every(Boolean), broken };
      }, imageList);
      expect(imgs, `Seviye ${level} çevrimdışı görseller`).toEqual({ allOk: true, broken: [] });
    }

    // Yeni macera (kayıt varken Yeni Macera onay ister; bu adım kayıtsız başlar)
    await page.evaluate(() => localStorage.removeItem("mavi-matematik-save"));
    await page.goto("./");
    await expect(page.locator("#startDialog")).toBeVisible();
    await page.locator("#startButton").tap();
    await expect(page.locator("#startDialog")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__.player.grounded)).toBe(true);

    // Çevrimdışıyken görseller önbellekten gelir
    const imagesOk = await page.evaluate(async () => {
      const paths = ["assets/img/player_spritesheet_clean.png", "assets/img/enemy_boss_4_clean.png"];
      const results = await Promise.all(paths.map((p) => fetch(p).then((r) => r.ok && r.headers.get("content-type").includes("png"))));
      return results.every(Boolean);
    });
    expect(imagesOk).toBe(true);

    // Çevrimdışı soru: ekran tuş takımıyla doğru cevap
    await page.evaluate(() => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    const answer = await page.evaluate(() => window.__MAVI_GAME__.state.currentQuestion.answer);
    for (const d of String(answer)) await page.locator(`[data-digit="${d}"]`).tap();
    await page.locator("#answerButton").tap();
    await expect(page.locator("#questionFeedback")).toHaveText("Doğru!");
    await expect(page.locator("#questionDialog")).toBeHidden();
    expect(await page.evaluate(() => window.__MAVI_GAME__.state.score)).toBe(50);

    // Çevrimdışıyken seviye verisi önbellekten gelir: Seviye 3 kanyon geometrisiyle açılır
    await page.goto("./?level=3&autostart=1");
    await expect.poll(() => page.evaluate(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.state.level)).toBe(3);
    const lv = await page.evaluate(() => {
      const g = window.__MAVI_GAME__;
      return { levels: g.levelData.levels.length, name: g.levelData.levels[2].name, p1: [g.platforms[1].x, g.platforms[1].y] };
    });
    expect(lv).toEqual({ levels: 4, name: "Gün Batımı Kanyonu", p1: [830, 600] });
    await context.setOffline(false);
  });

  test("güncelleme: 'Yeni sürüm hazır' bildirimi, kendiliğinden yenilemez, 'Şimdi Güncelle' tek kez yeniler", async ({ browser }, testInfo) => {
    test.slow();
    // İki sürüm üret: A (kurulu) ve B (yeni). Sunucu bir sembolik bağ üzerinden hangisini sunacağını seçer.
    const tmp = mkdtempSync(join(tmpdir(), "mavi-update-"));
    const a = join(tmp, "a");
    const b = join(tmp, "b");
    const current = join(tmp, "current");
    execFileSync(process.execPath, [join(ROOT, "tools/build.mjs"), "--out", a], { stdio: "pipe" });
    cpSync(a, b, { recursive: true });
    writeFileSync(join(b, "game.js"), `${readFileSync(join(b, "game.js"), "utf8")}\n// yeni sürüm\n`);
    const sw = readFileSync(join(b, "service-worker.js"), "utf8").replace(/const CACHE_VERSION = "([^"]+)";/, 'const CACHE_VERSION = "$1-yeni";');
    writeFileSync(join(b, "service-worker.js"), sw);
    symlinkSync(a, current);
    // Paralel/tekrarlı çalıştırmalarda port çakışmasın
    const port = 4200 + testInfo.workerIndex * 10 + testInfo.repeatEachIndex;
    const server = spawn(process.execPath, [join(ROOT, "tools/preview.mjs"), "--port", String(port), "--dir", current, "--base", BASE_PATH], { stdio: "ignore" });
    const url = `http://127.0.0.1:${port}${BASE_PATH}`;
    try {
      await expect.poll(async () => (await fetch(url).catch(() => null))?.status ?? 0).toBe(200);
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let navigations = 0;
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) navigations += 1;
      });
      const cacheNames = () => page.evaluate(async () => (await caches.keys()).filter((n) => n.startsWith("mavi-matematik-")));

      // İlk kurulum: sayfa kendiliğinden yenilenmez
      await page.goto(url);
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
      });
      await page.reload();
      await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
      await page.waitForTimeout(1200);
      expect(navigations).toBe(2);
      const oldCaches = await cacheNames();
      expect(oldCaches.length).toBe(1);
      const banner = page.locator("#startDialog [data-update-banner]");
      await expect(banner).toBeHidden();
      // Oyuncu verisi: kampanya kaydı, ayarlar ve top-10 güncellemeden sonra aynen kalmalı
      await page.evaluate(() => {
        localStorage.setItem("mavi-matematik-save", JSON.stringify({ version: 1, level: 3, score: 640, totalStats: { coins: 20, questions: 8, correct: 7 }, savedAt: "2026-09-26T10:00:00Z" }));
        localStorage.setItem("mavi-matematik-settings", JSON.stringify({ version: 1, sound: false, motion: "reduced" }));
        localStorage.setItem("mavi-matematik-sound", "off");
        localStorage.setItem("mavi-matematik-high-scores", JSON.stringify([{ name: "Ada", score: 1500, level: 4, date: "2026-09-25T10:00:00Z" }]));
      });
      const storedBefore = await page.evaluate(() => ({ ...localStorage }));

      // Yeni sürüm yayınlandı
      unlinkSync(current);
      symlinkSync(b, current);
      await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(banner).toContainText("Yeni sürüm hazır");
      await page.waitForTimeout(1000);
      expect(navigations, "güncelleme kendiliğinden uygulanmamalı").toBe(2);

      // Sonra: bildirim kapanır, yenileme yok; sayfa yeniden açılınca bekleyen sürüm yine bildirilir
      await banner.locator("[data-update-later]").tap();
      await expect(banner).toBeHidden();
      await page.waitForTimeout(500);
      expect(navigations).toBe(2);
      await page.reload();
      expect(navigations).toBe(3);
      await expect(banner).toBeVisible({ timeout: 15000 });

      // Şimdi Güncelle: tam olarak bir yenileme, döngü yok, eski önbellek silinir
      await banner.locator("[data-update-now]").tap();
      await expect.poll(() => navigations, { timeout: 15000 }).toBe(4);
      await page.waitForTimeout(2500);
      expect(navigations, "sonsuz yenileme olmamalı").toBe(4);
      await expect.poll(cacheNames).toEqual([`${oldCaches[0]}-yeni`]);
      await expect(page.locator("#startDialog [data-update-banner]")).toBeHidden();
      expect(await page.evaluate(() => document.querySelector('script[src^="game.js"]') !== null)).toBe(true);
      expect(await page.evaluate(() => ({ ...localStorage })), "güncelleme oyuncu verisini değiştirmemeli").toEqual(storedBefore);
      await expect(page.locator("#saveInfoLevel")).toHaveText("Seviye 3 — Gün Batımı Kanyonu");
      await expect(page.locator("html")).toHaveClass(/reduce-motion/);
      await expect(page.locator("html")).toHaveClass(/sound-muted/);
      expect(errors).toEqual([]);
      await ctx.close();
    } finally {
      server.kill();
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
