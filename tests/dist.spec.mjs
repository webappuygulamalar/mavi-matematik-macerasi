// dist/ yayın paketi üzerinde PWA ve çevrimdışı smoke testi.
// Paket GitHub Pages benzeri bir alt dizinde (/mavi-matematik-macerasi/) sunulur.
import { test as base, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
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
    const allowed = /^(index\.html|styles\.css|game\.js|pwa\.js|manifest\.webmanifest|service-worker\.js|build-info\.json|assets\/(img|icons)\/[\w.-]+\.png)$/;
    for (const f of files) expect(f, "izin verilmeyen dosya").toMatch(allowed);
    for (const f of listFiles(DIST)) expect(statSync(f).size, f).toBeLessThan(2 * 1024 * 1024);
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

    await context.setOffline(true);
    await page.reload();
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
    await context.setOffline(false);
  });
});
