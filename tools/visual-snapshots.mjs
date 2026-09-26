// Görsel karşılaştırma için sahne ekran görüntüleri alır (piksel testi değildir, göz kontrolü içindir).
// Kullanım: node tools/visual-snapshots.mjs <çıktı-klasörü>
// Çıktı klasörü .gitignore'daki visual-snapshots/ altında tutulur; yayın paketine girmez.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, process.argv[2] || "visual-snapshots/latest");
mkdirSync(outDir, { recursive: true });
const PORT = 8131;
const server = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
await new Promise((r) => setTimeout(r, 800));
const base = `http://127.0.0.1:${PORT}/?nosw=1`;

const profiles = [
  { name: "telefon-844x390", viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
  { name: "masaustu-1440x900", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
];

const browser = await chromium.launch();
try {
  for (const profile of profiles) {
    const { name, ...opts } = profile;
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const shot = (scene) => page.screenshot({ path: join(outDir, `${name}-${scene}.png`) });
    const ready = () => page.waitForFunction(() => window.__MAVI_GAME__ && window.__MAVI_GAME__.player.grounded);

    await page.goto(base);
    await page.waitForTimeout(500);
    await shot("01-baslangic");

    await page.locator("#startButton").click();
    await ready();
    await page.waitForTimeout(300);
    await shot("02-seviye1");

    // Üstü açık bir noktaya taşı (yüzen platformların altında zıplama tavana çarpar)
    await page.evaluate(() => {
      const g = window.__MAVI_GAME__;
      g.player.x = 1000;
      g.state.cameraX = 560;
    });
    await page.waitForTimeout(200);
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(250);
    await shot("03-kosma");
    await page.keyboard.down("Space");
    await page.waitForTimeout(140);
    await shot("04-zipla");
    await page.keyboard.up("Space");
    await page.waitForTimeout(260);
    await shot("05-tepe-dusus");
    await page.keyboard.up("KeyD");
    await page.waitForTimeout(700);

    await page.evaluate(() => window.__MAVI_GAME__.test.activateBox(window.__MAVI_GAME__.boxes[0]));
    await page.waitForTimeout(300);
    await shot("06-soru");
    const answer = await page.evaluate(() => window.__MAVI_GAME__.state.currentQuestion.answer);
    await page.locator("#answerInput").evaluate((el, v) => {
      el.readOnly = false;
      el.value = String(v);
    }, answer);
    await page.locator("#answerButton").click();
    await page.waitForTimeout(250);
    await shot("06b-dogru-cevap");
    await page.waitForTimeout(650);
    await shot("06c-kalkan-parlama");

    for (const level of [1, 2, 3, 4]) {
      await page.goto(`${base}&autostart=1&boss=1&level=${level}`);
      await ready();
      await page.waitForTimeout(900);
      await shot(`07-boss-seviye${level}`);
    }
    // Kutlama sırasında fizik güncellenmez; "yerde" beklemek kutlamayı kaçırır
    await page.goto(`${base}&autostart=1&boss=1&level=2&celebrate=1`);
    await page.waitForTimeout(1500);
    await shot("09-kutlama");
    await page.goto(`${base}&autostart=1&boss=1&level=1&rocket=1`);
    await ready();
    await page.waitForTimeout(1500);
    await shot("08-roket");
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`Ekran görüntüleri: ${outDir}`);
